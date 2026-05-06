# Owner Portal Design

## Goal

Give shelter owners a proper login-based portal where they can manage their own shelters — edit content, set pricing, and upload photos — without needing admin assistance. Supports multiple shelters per owner.

## Architecture

Supabase Auth (email + password) for session management via `@supabase/ssr`. No RLS — API routes explicitly verify that the authenticated user owns the shelter being acted on. Token-based access (`/owner/[token]`) continues to work as read-only backup. New routes live under `/ejer/*` and are protected by Next.js middleware.

## Tech Stack

- **Auth:** Supabase Auth (email + password, built-in password reset)
- **Session:** `@supabase/ssr` cookie-based sessions (already installed)
- **Storage:** Existing `shelter-photos` Supabase Storage bucket, new path prefix `owner/[shelter_id]/`
- **DB:** Single new column `auth_user_id uuid` on `bookable_shelters`

---

## Data Model Changes

### `bookable_shelters` — new column

```sql
ALTER TABLE bookable_shelters
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

- Nullable — existing shelters start with `null`
- Populated when an owner signs up with the same email as their shelter's `owner_email`
- One `auth_user_id` can appear on multiple rows (owner with multiple shelters)

### No new tables required

Supabase Auth manages `auth.users` automatically. No separate `owner_accounts` table needed.

---

## Pages

### `/ejer/login`
- Email + password form
- "Glemt adgangskode?" link → Supabase handles reset email automatically
- On success → redirect to `/ejer/dashboard`
- Already-logged-in users are redirected away by middleware

### `/ejer/signup`
- Email + password + confirm password
- On success: Supabase creates auth user, API links `auth_user_id` on any `bookable_shelters` rows where `owner_email` matches
- Redirect to `/ejer/dashboard`
- If no matching shelter found → show message "Ingen shelter fundet med denne email — kontakt os"

### `/ejer/dashboard`
- Lists all shelters where `auth_user_id = current user`
- Each shelter shows: title, active booking count, two buttons: "Rediger" and "Bookinger"
- "Bookinger" links to existing `/owner/[token]` dashboard for now

### `/ejer/shelter/[id]/rediger`
- Edit form: titel, beskrivelse, maks. antal personer, pris pr. nat
- Image gallery: shows existing photos with delete button per photo
- Upload zone: drag-and-drop or file picker, max 5 MB, JPEG/PNG/WebP
- Save button → PATCH `/api/ejer/shelter/[id]`
- Images upload immediately on file selection, appear in gallery instantly

---

## API Routes

All `/api/ejer/*` routes require a valid Supabase session. They read the session from cookies using `@supabase/ssr`, get the `auth.uid()`, then verify the target shelter has `auth_user_id = auth.uid()` before proceeding.

### `POST /api/ejer/login`
Calls `supabase.auth.signInWithPassword({ email, password })`. Sets session cookie. Returns `{ ok: true }` or `{ error }`.

### `POST /api/ejer/signup`
Calls `supabase.auth.signUp({ email, password })`. On success, updates `bookable_shelters SET auth_user_id = new_user_id WHERE owner_email = email AND auth_user_id IS NULL`. Returns `{ ok: true, sheltersLinked: number }`.

**Email confirmation:** Supabase email confirmation must be **disabled** in the project's Auth settings (Authentication → Email → "Confirm email" toggle off). This allows immediate session creation on signup without an email round-trip. Given the small number of trusted owners, this is the correct tradeoff.

**Co-owner edge case:** If two people sign up with the same `owner_email`, the second signup gets no shelters linked (the `auth_user_id IS NULL` guard prevents overwriting). This is acceptable — the admin can manually update `auth_user_id` if needed.

### `POST /api/ejer/logout`
Calls `supabase.auth.signOut()`. Clears session cookie.

### `GET /api/ejer/shelters`
Returns all `bookable_shelters` rows where `auth_user_id = auth.uid()`, plus booking count for each.

### `PATCH /api/ejer/shelter/[id]`
Accepts `{ title?, description?, max_persons?, shelter_price_dkk? }`. Validates ownership, updates the `bookable_shelters` row directly — all four fields (`title`, `description`, `max_persons`, `shelter_price_dkk`) live on `bookable_shelters`, not on `shelters`. Returns updated shelter.

### `POST /api/ejer/shelter/[id]/billeder`
Accepts `FormData` with `file`. Validates ownership, validates file type/size (max 5 MB, JPEG/PNG/WebP). Uploads to `shelter-photos` bucket at path `owner/[shelter_id]/[uuid].[ext]`. Appends public URL to `shelters.user_image_urls[]` (via the linked `shelter_id`). Returns `{ ok: true, url }`.

### `DELETE /api/ejer/shelter/[id]/billeder`
Accepts `{ path: string }`. Validates ownership and that path starts with `owner/[shelter_id]/` (prevents deleting other shelters' files). Deletes from Storage, removes URL from `user_image_urls[]`. Returns `{ ok: true }`.

---

## Middleware

`middleware.ts` (new or extended):

```ts
// Protect /ejer/* except /ejer/login and /ejer/signup
matcher: ['/ejer/:path*']
```

- Reads Supabase session from cookies using `@supabase/ssr` `createServerClient`
- No session → redirect to `/ejer/login?next=[current path]`
- Valid session → pass through
- `/ejer/login` and `/ejer/signup` exempt from protection

---

## Auth Utils

New file `utils/supabase/server-session.ts`:

```ts
// Creates a Supabase client that reads/writes session cookies
// Used by middleware and API routes under /ejer/*
export function createSessionClient(cookieStore: ReadonlyRequestCookies)
```

Wraps `@supabase/ssr`'s `createServerClient` with the project's env vars.

---

## Image Storage

- **Bucket:** `shelter-photos` (existing, reuse)
- **Path:** `owner/[bookable_shelter_id]/[uuid].[ext]`
- **Visibility:** Public (same as community photos)
- **Written to:** `shelters.user_image_urls[]` — the array field already used by community-approved photos and displayed on the shelter detail page
- **Ownership check:** Path prefix `owner/[shelter_id]/` prevents cross-shelter deletion

Note: `bookable_shelters.shelter_id` is the foreign key to `shelters.id`. If `shelter_id` is null (shelter not yet linked to main catalogue), image upload is disabled with a message "Linkopret shelter i admin-panelet først."

---

## Token-Based Access (Backwards Compatibility)

`/owner/[token]` continues to work unchanged — shows bookings, calendar, blocked dates. No editing features are added there. Owners who haven't created an account yet can still manage bookings via their token link.

---

## Editable Fields

| Field | Editable by owner | Notes |
|---|---|---|
| `title` | ✅ | Max 100 chars |
| `description` | ✅ | Max 2000 chars |
| `max_persons` | ✅ | 1–50 |
| `shelter_price_dkk` | ✅ | 0–9999, whole DKK |
| `payment_mode` | ❌ | Admin only |
| `platform_fee_pct` / `platform_fee_min_dkk` | ❌ | Admin only |
| `cancellation_cutoff_hours` | ❌ | Admin only |
| `ical_import_url` | ❌ | Admin only |
| `booking_mode` | ❌ | Admin only |
| Photos (`user_image_urls`) | ✅ | Via upload/delete endpoints |

---

## Error Handling

- **Login failure:** "Forkert email eller adgangskode" (do not distinguish between the two)
- **Signup — no matching shelter:** "Vi fandt ingen shelter med denne email. Kontakt os på [email]."
- **Signup — email already registered:** Supabase returns error, show "Der findes allerede en konto med denne email. Log ind i stedet."
- **Upload — wrong type/size:** Shown inline below the upload zone
- **Upload — shelter_id is null:** Upload button disabled, tooltip "Sheltet er endnu ikke linket til kataloget"
- **Session expired:** Middleware redirects to `/ejer/login`

---

## Testing

- Login with valid credentials → session cookie set, redirect to dashboard
- Login with wrong password → error message shown, no redirect
- Signup with existing `owner_email` → `auth_user_id` linked, dashboard shows shelter
- Signup with unknown email → warning shown
- PATCH shelter owned by user → 200, fields updated
- PATCH shelter owned by other user → 403
- Upload image → URL appears in gallery, visible on shelter page
- Delete image with wrong path prefix → 403
- `/owner/[token]` still loads for existing token users
- Middleware: unauthenticated request to `/ejer/dashboard` → redirect to `/ejer/login`
