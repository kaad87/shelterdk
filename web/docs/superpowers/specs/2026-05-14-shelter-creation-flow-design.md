# Shelter Creation Flow — Design Spec

## Context

Shelter owners and operators want to get their shelters listed on ShelterDK. Currently there is no self-service path — shelters are imported from GeoFA data. This feature adds a public submission form where anyone can submit a shelter for review, and an admin UI where the submission can be approved (creating a live shelter) or rejected (with a reason).

Existing infrastructure already in place:
- `shelter_submissions` table (type, status, name, location_text, capacity, description, facilities JSONB, booking_url, contact info)
- `POST /api/submit-shelter` — validated insert, rate-limited
- `GET /api/admin/pending-shelter-submissions` — list pending
- `POST /api/admin/approve-shelter-submission` — updates status only (needs extending)
- `POST /api/admin/reject-shelter-submission` — updates status only (needs extending)

---

## Scope

One project covering the full loop:
1. DB migration — extend `shelter_submissions` with coordinates + photo URLs
2. Supabase Storage bucket for submission photos
3. Public submission form at `/opret-shelter`
4. Photo upload API endpoint
5. Update `/api/submit-shelter` to accept lat/lng and photo_urls
6. Admin review UI at `/admin/shelter-ansogninger`
7. Approve route creates shelter in `shelters` table + sends approval email
8. Reject route sends rejection email
9. Admin index link

---

## Data Layer

### Migration: extend `shelter_submissions`

```sql
ALTER TABLE shelter_submissions
  ADD COLUMN IF NOT EXISTS lat float8 null,
  ADD COLUMN IF NOT EXISTS lng float8 null,
  ADD COLUMN IF NOT EXISTS photo_urls text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS region_hint text null,
  ADD COLUMN IF NOT EXISTS kommune_hint text null,
  ADD COLUMN IF NOT EXISTS place_hint text null,
  ADD COLUMN IF NOT EXISTS shelter_id uuid null references shelters(id) on delete set null;
```

`lat`/`lng` — from the map picker in the form. Nullable: owner may skip the map.
`photo_urls` — Supabase Storage URLs of uploaded photos (stored in submissions bucket before approval).
`region_hint`, `kommune_hint`, `place_hint` — set by admin during review; used when creating the shelter.

### Supabase Storage

New bucket: `shelter-submissions`
- Access: private (service role only)
- Path pattern: `pending/{uuid}.{ext}` — all uploads go here before the submission is created. No submissionId prefix is needed because the URLs are collected in the form state and sent with the final submit.
- On approval: each photo is downloaded from `shelter-submissions` and re-uploaded to `owner/{shelter_id}/{uuid}.{ext}` in the existing shelter photos bucket. Supabase Storage does not support cross-bucket copy — download + re-upload is required. If re-upload of any photo fails, log the error and continue (shelter is created without that photo rather than blocking the whole approval).
- On rejection: delete all `photo_urls` from `shelter-submissions` bucket using the admin client.
- Orphaned files (form abandoned mid-upload): acceptable. A weekly cleanup job (Supabase scheduled function or manual cron) deletes files in `shelter-submissions/pending/` older than 7 days that are not referenced in any `photo_urls` column.

---

## Public Form — `/opret-shelter`

**Route:** `app/(site)/opret-shelter/page.tsx` — server component wrapper + `"use client"` form component.

**Four sections:**

### 1. Om shelteret
- `shelter_name` (required, max 200) — text input
- `location_text` (required, max 200) — free text, e.g. "Gribskov, tæt på Esrum Sø"
- `capacity` (optional) — number input, min 1
- `description` (optional, max 4000) — textarea
- `booking_url` (optional) — text input with http(s) validation

### 2. Placering på kort
- Leaflet map (already used on the site — import pattern from existing map components)
- User clicks or drags a pin to set location
- Shows lat/lng readout below map
- If skipped: yellow notice "Admin vil sætte koordinater ved gennemgang"
- Stores `lat` and `lng` in form state

### 3. Faciliteter
Checkbox group: Vand 💧 | Toilet 🚽 | Bålplads 🔥 | Parkering 🅿️ | Hund tilladt 🐕

Canonical facilities keys (used in the `facilities` JSONB payload and throughout the codebase):
- `vand` → maps to `shelters.water`
- `toilet` → maps to `shelters.toilet`
- `baalplads` → maps to `geofa_raw.baalplads`
- `parkering` → stored in facilities JSONB only (no geofa_raw or dedicated column yet)
- `hunde_tilladt` → maps to `geofa_raw.hunde_tilladt`

Note: the existing `FACILITY_KEYS` in `lib/shelter-submissions.ts` uses `hund` — this must be updated to `hunde_tilladt` in that file and in the approve route logic. Using `hund` would cause the dog filter to never match on owner-submitted shelters.

### 4. Billeder + kontakt
- Photo upload: up to 5 files, JPEG/PNG only, max 5 MB each
- Upload happens immediately on file selection (one at a time) via `POST /api/submit-shelter/photos`
- Shows thumbnail + remove button per uploaded photo
- `contact_name` (optional) — text input
- `contact_email` (required) — email input

**Submit flow:**
1. Client POSTs `{ type: "owner_registration", shelter_name, location_text, lat, lng, capacity, description, facilities, booking_url, contact_name, contact_email, photo_urls }` to `/api/submit-shelter`
2. On 201: show success screen ("Tak! Vi gennemgår dit shelter og vender tilbage.")
3. On error: show inline error, keep form state

**No login required.**

---

## Photo Upload API — `POST /api/submit-shelter/photos`

**Auth:** None (public). Rate-limited to 10 uploads/minute per IP (separate counter from submit).

**Request:** `multipart/form-data` with field `file` (image only).

**Server steps:**
1. Validate Content-Type header is `multipart/form-data` and file field exists
2. Validate file: must be `image/jpeg` or `image/png`, max 5 MB — reject before reading full stream
3. Generate `fileId = crypto.randomUUID()`
4. Upload to `shelter-submissions/pending/{fileId}.{ext}` using admin Supabase client
5. Generate a signed URL (60-minute TTL) for thumbnail preview: `supabase.storage.from("shelter-submissions").createSignedUrl(path, 3600)`
6. Return `{ path: string, previewUrl: string }` — client stores `path` in form state (sent in submit body) and uses `previewUrl` for the thumbnail display

**No submissionId needed at upload time.** All photo URLs are collected in the form and sent with the final submit body.

**File size guard:** Check `Content-Length` header first; reject > 5 MB immediately before reading body.

---

## Update `/api/submit-shelter`

Add to accepted body:
- `lat?: number | null` — validated: must be finite, -90 to 90
- `lng?: number | null` — validated: must be finite, -180 to 180
- `photo_urls?: string[]` — max 5 entries. The photo upload API returns the storage path (not a public URL) since the bucket is private. The client sends the path string `pending/{uuid}.{ext}`. Server validates each entry matches the pattern `/^pending\/[0-9a-f-]{36}\.(jpg|jpeg|png)$/i` to prevent path traversal. The full download URL is constructed server-side using the admin client when needed.

Insert these columns alongside existing fields.

---

## Admin Review UI — `/admin/shelter-ansogninger`

**Pattern:** Same `"use client"` + sessionStorage secret as other admin pages.

**List view:**
- Fetches from `GET /api/admin/pending-shelter-submissions` (already returns all fields; needs `lat`, `lng`, `photo_urls` added to SELECT)
- Each card: shelter name, location text, date submitted, photo count badge, "Gennemgå"-button

**Expanded review panel** (inline, replaces card):
- All submission fields displayed
- Photos as clickable thumbnails (open full size)
- Mini Leaflet map showing pin at submitted coordinates — admin can drag pin to adjust
- Fields for `region`, `kommune`, `place` (admin fills in, required before approving)
- Approve button: disabled until region is filled
- Reject button: opens inline textarea for rejection reason (required)

**After approve/reject:** card disappears from list, success/error banner shown.

---

## Approve Route — extend `POST /api/admin/approve-shelter-submission`

New body fields: `region`, `kommune`, `place`, `lat`, `lng` (admin-adjusted coordinates).

**Steps:**
1. Auth check
2. Validate: `submissionId` (UUID), `region` (non-empty), `lat`/`lng` (finite numbers)
3. Fetch submission from DB
4. Generate slug: `slugify(submission.shelter_name) + '-' + nanoid(6)` (guaranteed unique)
5. Download each photo from `shelter-submissions` bucket and re-upload to `owner/{newShelterId}/{uuid}.{ext}` in the shelter photos bucket. Supabase Storage does not support cross-bucket copy — must download bytes then upload. Collect successfully re-uploaded URLs. Failures are logged and skipped (do not block approval).
6. Insert into `shelters`:
   ```
   title           ← shelter_name
   slug            ← generated
   description     ← description
   location        ← 'POINT(lng lat)' as a plain text string — MUST use this exact format,
                      NOT ST_MakePoint(), because the site parses location with a regex:
                      /POINT\(([^ ]+) ([^ ]+)\)/ expecting the string form.
   region          ← admin-provided
   kommune         ← admin-provided (may be empty string → store as null)
   place           ← admin-provided (may be empty string → store as null)
   water           ← facilities.vand ?? false
   toilet          ← facilities.toilet ?? false
   capacity        ← capacity
   booking_url     ← booking_url (null if empty)
   user_image_urls ← { urls: [re-uploaded photo URLs] }
   geofa_raw       ← build from checked facilities:
                      { baalplads: "Ja" }        if facilities.baalplads
                      { hunde_tilladt: "Ja" }    if facilities.hunde_tilladt
                      Note: parkering has no geofa_raw filter in the codebase — do NOT
                      include it in geofa_raw. It can be added to a future dedicated column.
   ```
7. If shelter insert fails: do NOT send email, return 500. Photos re-uploaded in step 5 are orphaned — log the shelter_id and photo paths for manual cleanup.
8. Update `shelter_submissions` status to `"approved"`, store `shelter_id` reference
8. Send approval email to `contact_email`
9. Return `{ ok: true, shelterId, slug }`

**Error handling:** If shelter insert fails, do NOT send email. If email fails after insert, log but do not roll back (shelter is live — return 500 with message "Shelter oprettet men email fejlede").

---

## Reject Route — extend `POST /api/admin/reject-shelter-submission`

New body fields: `reason` (required string, max 1000 chars).

**Steps:**
1. Auth check + validate
2. Update submission status to `"rejected"`, store `rejected_reason`
3. Delete each file in `submission.photo_urls` individually from the `shelter-submissions` bucket using the admin client. Files live at `pending/{uuid}.{ext}` — there is no per-submission subdirectory. Extract the storage path from each URL and call `storage.from("shelter-submissions").remove([path])` for each.
4. Send rejection email to `contact_email`
5. Return `{ ok: true }`

---

## Email Functions (add to `lib/email.ts`)

### `sendShelterApprovedEmail`
- **To:** `contact_email`
- **Subject:** `"Dit shelter er nu på ShelterDK 🏕️"`
- **Body:** Congratulations, shelter name, link to `/shelter/{slug}`, "Du kan svare på denne mail med spørgsmål."
- **Signature:** Christian / ShelterDK (same as admin reply emails)
- **Logged:** `category: "contact"`, `emailType: "shelter_approved"`

### `sendShelterRejectedEmail`
- **To:** `contact_email`
- **Subject:** `"Din shelter-ansøgning til ShelterDK"`
- **Body:** Thank you for submitting, unfortunately we cannot approve, shows rejection reason, "Du er velkommen til at indsende igen."
- **Logged:** `category: "contact"`, `emailType: "shelter_rejected"`

---

## Admin Index

Add link to `/admin/page.tsx`:
```tsx
<Link href="/admin/shelter-ansogninger">🏕️ Shelter-ansøgninger</Link>
```

---

## Files Changed

| File | Action | Responsibility |
|------|--------|----------------|
| `migrations/20260514_shelter_submissions_extend.sql` | Create | Add lat/lng/photo_urls/region_hint/shelter_id columns |
| `app/(site)/opret-shelter/page.tsx` | Create | Public submission form (server wrapper) |
| `components/ShelterSubmissionForm.tsx` | Create | "use client" form with map, upload, all fields |
| `app/api/submit-shelter/photos/route.ts` | Create | Photo upload to Supabase Storage |
| `app/api/submit-shelter/route.ts` | Modify | Accept lat/lng/photo_urls |
| `app/api/admin/pending-shelter-submissions/route.ts` | Modify | Include new columns in SELECT |
| `app/api/admin/approve-shelter-submission/route.ts` | Modify | Create shelter, copy photos, send email |
| `app/api/admin/reject-shelter-submission/route.ts` | Modify | Delete photos, send email |
| `lib/email.ts` | Modify | Add sendShelterApprovedEmail, sendShelterRejectedEmail |
| `lib/shelter-submissions.ts` | Modify | Add new fields to types |
| `app/(site)/admin/shelter-ansogninger/page.tsx` | Create | Admin review UI |
| `app/(site)/admin/page.tsx` | Modify | Add link |

## What Is NOT Changed

- Existing shelter search/filter logic (new shelters slot in automatically via `shelters` table)
- GeoFA import pipeline
- Ejer portal (login-based owner flow)
- Booking system
- Community submissions

---

## Verification Checklist

1. `/opret-shelter` renders and all fields validate client-side
2. Map picker sets lat/lng; skipping shows warning
3. Photo upload: selecting a file uploads immediately, thumbnail appears, remove works
4. Submit with valid data → 201 → success screen shown
5. Submit without required fields → 400 → error shown inline
6. Admin page loads pending submissions list
7. Expanding a submission shows all fields + photos + map pin
8. Approving without region filled → button disabled
9. Approving with all fields → shelter appears in `/soeg` search results
10. Approval email arrives at contact_email
11. Rejecting with reason → submission removed from list
12. Rejection email arrives with reason text
13. Photos cleaned up from submissions bucket on rejection
14. Admin index shows 🏕️ Shelter-ansøgninger link
