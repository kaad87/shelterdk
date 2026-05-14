# Shelter Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public self-service shelter submission form at `/opret-shelter` plus an admin review UI at `/admin/shelter-ansogninger` — full loop from public submit through photo upload, admin approve/reject, to email confirmation.

**Architecture:** Public form (no auth) posts to existing `/api/submit-shelter` (extended) and a new photo-upload endpoint; admin page fetches pending submissions, expands each into a review panel with a Leaflet map, and POSTs to extended approve/reject routes that create the shelter in the DB, copy photos between Supabase Storage buckets, and send emails.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase Postgres + Storage (admin client), react-leaflet (dynamic import, SSR:false), Resend via `sendLoggedEmail`, vitest for unit tests on pure functions.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `migrations/20260514_shelter_submissions_extend.sql` | Create | Add lat/lng/photo_urls/region_hint/kommune_hint/place_hint/shelter_id columns |
| `lib/shelter-submissions.ts` | Modify | Fix `hund`→`hunde_tilladt`, add lat/lng/photo_urls to types |
| `lib/email.ts` | Modify | Add `buildShelterApprovedEmailHtml`, `buildShelterRejectedEmailHtml`, `sendShelterApprovedEmail`, `sendShelterRejectedEmail` |
| `lib/__tests__/shelter-email.test.ts` | Create | Unit tests for email builder functions |
| `app/api/submit-shelter/photos/route.ts` | Create | Photo upload → shelter-submissions bucket, returns signed preview URL |
| `app/api/submit-shelter/route.ts` | Modify | Accept lat/lng/photo_urls with validation |
| `app/api/admin/pending-shelter-submissions/route.ts` | Modify | Include lat/lng/photo_urls in SELECT + generate signed preview URLs for photos |
| `app/api/admin/approve-shelter-submission/route.ts` | Modify | Create shelter, copy photos, send approval email |
| `app/api/admin/reject-shelter-submission/route.ts` | Modify | Delete photos from storage, send rejection email |
| `components/ShelterSubmissionForm.tsx` | Create | "use client" multi-section form with Leaflet map picker + photo upload |
| `app/(site)/opret-shelter/page.tsx` | Create | Server-side wrapper, metadata, renders ShelterSubmissionForm |
| `app/(site)/admin/shelter-ansogninger/page.tsx` | Create | Admin review UI: list → expand panel → approve/reject |
| `app/(site)/admin/page.tsx` | Modify | Add 🏕️ Shelter-ansøgninger link |

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/20260514_shelter_submissions_extend.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/20260514_shelter_submissions_extend.sql
ALTER TABLE shelter_submissions
  ADD COLUMN IF NOT EXISTS lat float8 null,
  ADD COLUMN IF NOT EXISTS lng float8 null,
  ADD COLUMN IF NOT EXISTS photo_urls text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS region_hint text null,
  ADD COLUMN IF NOT EXISTS kommune_hint text null,
  ADD COLUMN IF NOT EXISTS place_hint text null,
  ADD COLUMN IF NOT EXISTS shelter_id uuid null references shelters(id) on delete set null;
```

- [ ] **Step 2: Apply migration in Supabase**

Go to the Supabase dashboard → SQL editor → paste and run the migration. Confirm all 7 `ADD COLUMN` statements succeed without errors.

- [ ] **Step 3: Commit**

```bash
git add migrations/20260514_shelter_submissions_extend.sql
git commit -m "feat: extend shelter_submissions with lat/lng/photos/hints/shelter_id"
```

---

## Task 2: Update `lib/shelter-submissions.ts`

**Files:**
- Modify: `lib/shelter-submissions.ts`

The canonical dog-facility key is `hunde_tilladt` (matches `geofa_raw.hunde_tilladt`). Currently the file uses `hund` — this must be fixed now, before new code references it.

- [ ] **Step 1: Fix FACILITY_KEYS and add new types**

Replace the entire file content:

```typescript
// web/lib/shelter-submissions.ts

export type SubmissionType = "owner_registration" | "user_tip";
export type SubmissionStatus = "pending" | "approved" | "rejected";

/** Canonical facility keys stored in the `facilities` JSONB column */
export const FACILITY_KEYS = [
  "vand",
  "toilet",
  "baalplads",
  "parkering",
  "hunde_tilladt",
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  vand: "💧 Vand",
  toilet: "🚽 Toilet",
  baalplads: "🔥 Bålplads",
  parkering: "🅿️ Parkering",
  hunde_tilladt: "🐕 Hund tilladt",
};

export interface ShelterSubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  shelter_name: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  photo_urls: string[];
  capacity: number | null;
  description: string | null;
  facilities: Partial<Record<FacilityKey, boolean>> | null;
  booking_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  source_info: string | null;
  admin_note: string | null;
  rejected_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  shelter_id: string | null;
}

/** Payload shape accepted by POST /api/submit-shelter */
export interface SubmitShelterPayload {
  type: SubmissionType;
  shelter_name: string;
  location_text: string;
  lat?: number | null;
  lng?: number | null;
  photo_urls?: string[];
  capacity?: number | null;
  description?: string;
  facilities?: Partial<Record<FacilityKey, boolean>>;
  booking_url?: string;
  contact_name?: string;
  contact_email?: string;
  source_info?: string;
}

/** Photo path pattern for submissions bucket: pending/{uuid}.{ext} */
export const PHOTO_PATH_REGEX = /^pending\/[0-9a-f-]{36}\.(jpg|jpeg|png)$/i;
```

- [ ] **Step 2: Run tests to ensure no regressions**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | head -60
```

Expected: all tests pass (the `hund` key was only in this file and the approve/reject routes — those come later).

- [ ] **Step 3: Commit**

```bash
git add lib/shelter-submissions.ts
git commit -m "fix: rename facility key hund→hunde_tilladt, add lat/lng/photos to types"
```

---

## Task 3: Email Functions

**Files:**
- Modify: `lib/email.ts`
- Create: `lib/__tests__/shelter-email.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/shelter-email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildShelterApprovedEmailHtml,
  buildShelterRejectedEmailHtml,
} from "../email";

describe("buildShelterApprovedEmailHtml", () => {
  it("includes shelter name in subject area", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Skovhytten",
      shelterSlug: "skovhytten-abc123",
    });
    expect(html).toContain("Skovhytten");
  });

  it("links to the shelter page", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Ege Shelter",
      shelterSlug: "ege-shelter-xyz789",
    });
    expect(html).toContain("/shelter/ege-shelter-xyz789");
  });

  it("escapes HTML in shelter name", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "<script>alert(1)</script>",
      shelterSlug: "test-abc123",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes signature with shelterdk.dk", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Test",
      shelterSlug: "test-abc123",
    });
    expect(html).toContain("shelterdk.dk");
    expect(html).toContain("Christian");
  });
});

describe("buildShelterRejectedEmailHtml", () => {
  it("includes rejection reason", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Skovhytten",
      reason: "Mangler koordinater og billeder.",
    });
    expect(html).toContain("Mangler koordinater og billeder.");
  });

  it("escapes HTML in rejection reason", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Test",
      reason: "<b>bad</b>",
    });
    expect(html).not.toContain("<b>bad</b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("includes shelter name", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Havnens Shelter",
      reason: "Ikke nok info.",
    });
    expect(html).toContain("Havnens Shelter");
  });

  it("mentions submitting again", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Test",
      reason: "Test reason.",
    });
    expect(html.toLowerCase()).toMatch(/indsend|ansøg/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/shelter-email.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Add email builder functions to `lib/email.ts`**

Append after the `sendAdminReplyEmail` function (end of file):

```typescript
// ─── Shelter submission emails ─────────────────────────────────────────────

export function buildShelterApprovedEmailHtml(opts: {
  shelterName: string;
  shelterSlug: string;
}): string {
  const { shelterName, shelterSlug } = opts;
  const shelterUrl = `https://shelterdk.dk/shelter/${shelterSlug}`;
  return renderEmail({
    title: "Dit shelter er nu på ShelterDK 🏕️",
    preheader: `${escapeHtml(shelterName)} er godkendt og live på ShelterDK!`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Tillykke! Dit shelter <strong>${escapeHtml(shelterName)}</strong> er nu godkendt og live på ShelterDK.
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du kan se dit shelter her:<br>
        <a href="${shelterUrl}" style="color:#c5a059;text-decoration:none;">${shelterUrl}</a>
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du er velkommen til at svare på denne mail med spørgsmål.
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
    `,
  });
}

export function buildShelterRejectedEmailHtml(opts: {
  shelterName: string;
  reason: string;
}): string {
  const { shelterName, reason } = opts;
  return renderEmail({
    title: "Din shelter-ansøgning til ShelterDK",
    preheader: `Tak for din ansøgning om ${escapeHtml(shelterName)}.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Tak for at du indsendte <strong>${escapeHtml(shelterName)}</strong> til ShelterDK.
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Desværre kan vi ikke godkende ansøgningen på nuværende tidspunkt:
      </p>
      <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
        <p style="font-size:13px;color:#555;line-height:1.5;margin:0;">
          ${escapeHtml(reason).replace(/\n/g, "<br>")}
        </p>
      </blockquote>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du er velkommen til at indsende en ny ansøgning når ovenstående er på plads.
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
    `,
  });
}

export async function sendShelterApprovedEmail(opts: {
  toEmail: string;
  shelterName: string;
  shelterSlug: string;
  submissionId: string;
}) {
  const html = buildShelterApprovedEmailHtml(opts);
  const text = `Tillykke! Dit shelter "${opts.shelterName}" er nu godkendt og live på ShelterDK.\n\nhttps://shelterdk.dk/shelter/${opts.shelterSlug}\n\nDu er velkommen til at svare på denne mail med spørgsmål.\n\nMed venlig hilsen,\nChristian\nShelterDK · shelterdk.dk`;
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Dit shelter er nu på ShelterDK 🏕️",
    html,
    text,
    context: {
      category: "contact",
      emailType: "shelter_approved",
      metadata: { submissionId: opts.submissionId, shelterName: opts.shelterName },
    },
  });
}

export async function sendShelterRejectedEmail(opts: {
  toEmail: string;
  shelterName: string;
  reason: string;
  submissionId: string;
}) {
  const html = buildShelterRejectedEmailHtml(opts);
  const text = `Tak for din ansøgning om "${opts.shelterName}".\n\nDesværre kan vi ikke godkende ansøgningen:\n\n${opts.reason}\n\nDu er velkommen til at indsende igen.\n\nMed venlig hilsen,\nChristian\nShelterDK · shelterdk.dk`;
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Din shelter-ansøgning til ShelterDK",
    html,
    text,
    context: {
      category: "contact",
      emailType: "shelter_rejected",
      metadata: { submissionId: opts.submissionId, shelterName: opts.shelterName },
    },
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/shelter-email.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts lib/__tests__/shelter-email.test.ts
git commit -m "feat: add shelter approved/rejected email builder functions and senders"
```

---

## Task 4: Photo Upload API

**Files:**
- Create: `app/api/submit-shelter/photos/route.ts`

This endpoint accepts a multipart upload, stores to `shelter-submissions/pending/{uuid}.{ext}`, and returns the storage path + a 60-minute signed preview URL.

Rate limit: 10 uploads/minute per IP (separate counter from the submit-shelter counter).

- [ ] **Step 1: Create the route file**

```typescript
// app/api/submit-shelter/photos/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-submissions";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

// Rate limiting: 10 uploads/min per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const ipTimestamps = new Map<string, number[]>();

export async function POST(request: Request) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange uploads. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  // File size guard via Content-Length header
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SIZE_BYTES * 2) {
    // *2 for multipart overhead
    return Response.json({ error: "Filen er for stor (maks 5 MB)" }, { status: 413 });
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Ugyldig formdata" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Mangler fil-felt 'file'" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return Response.json(
      { error: "Kun JPEG og PNG understøttes" },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Filen er for stor (maks 5 MB)" }, { status: 400 });
  }

  const ext = EXT[file.type] ?? "jpg";
  const fileId = crypto.randomUUID();
  const storagePath = `pending/${fileId}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Submission photo upload error:", uploadError);
    return Response.json({ error: "Upload fejlede — prøv igen" }, { status: 500 });
  }

  // Signed URL for thumbnail preview (60 min TTL)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    console.error("Signed URL error:", signedError);
    // Upload succeeded — return path even without preview URL
    return Response.json({ path: storagePath, previewUrl: null });
  }

  return Response.json({ path: storagePath, previewUrl: signedData.signedUrl });
}
```

- [ ] **Step 2: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `shelter-submissions`
- Public: OFF (private)
- File size limit: 5 MB
- Allowed MIME types: `image/jpeg, image/png`

Then add a storage policy (service role can insert/select/delete): the admin client bypasses RLS, so no RLS policy needed for the admin client. Confirm uploads work.

- [ ] **Step 3: Commit**

```bash
git add app/api/submit-shelter/photos/route.ts
git commit -m "feat: add photo upload endpoint for shelter submissions"
```

---

## Task 5: Update `/api/submit-shelter`

**Files:**
- Modify: `app/api/submit-shelter/route.ts`

Add `lat`, `lng`, `photo_urls` to the accepted body, with validation.

- [ ] **Step 1: Update the route**

Replace the body parsing and insert section. Key changes:
1. Import `PHOTO_PATH_REGEX` from shelter-submissions
2. Validate lat/lng ranges
3. Validate photo_urls paths
4. Insert new columns

Full updated file:

```typescript
// web/app/api/submit-shelter/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { SubmissionType, FacilityKey, SubmitShelterPayload } from "@/lib/shelter-submissions";
import { FACILITY_KEYS, PHOTO_PATH_REGEX } from "@/lib/shelter-submissions";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const ipTimestamps = new Map<string, number[]>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES: SubmissionType[] = ["owner_registration", "user_tip"];

export async function POST(request: Request) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange forsøg. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  // Parse body
  let body: Partial<SubmitShelterPayload>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const type = body.type?.trim() as SubmissionType | undefined;
  const shelter_name = body.shelter_name?.trim();
  const location_text = body.location_text?.trim();

  // Validate required fields
  if (!type || !VALID_TYPES.includes(type)) {
    return Response.json(
      { error: "Feltet 'type' skal være 'owner_registration' eller 'user_tip'" },
      { status: 400 }
    );
  }
  if (!shelter_name || shelter_name.length === 0) {
    return Response.json({ error: "Shelterens navn er påkrævet" }, { status: 400 });
  }
  if (shelter_name.length > 200) {
    return Response.json({ error: "Navn må højst være 200 tegn" }, { status: 400 });
  }
  if (!location_text || location_text.length === 0) {
    return Response.json({ error: "Placering er påkrævet" }, { status: 400 });
  }
  if (location_text.length > 200) {
    return Response.json({ error: "Placering må højst være 200 tegn" }, { status: 400 });
  }

  // Email validation for owner_registration
  const contact_email = body.contact_email?.trim() || null;
  if (type === "owner_registration") {
    if (!contact_email) {
      return Response.json({ error: "Email er påkrævet for ejere/operatører" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(contact_email)) {
      return Response.json({ error: "Ugyldig email-adresse" }, { status: 400 });
    }
  }

  // source_info length
  const source_info = body.source_info?.trim() || null;
  if (source_info && source_info.length > 500) {
    return Response.json(
      { error: "Beskrivelse må højst være 500 tegn" },
      { status: 400 }
    );
  }

  // Validate lat/lng — both must be present or both absent
  let lat: number | null = null;
  let lng: number | null = null;
  if (body.lat != null || body.lng != null) {
    const rawLat = body.lat;
    const rawLng = body.lng;
    if (
      typeof rawLat !== "number" || !isFinite(rawLat) ||
      rawLat < -90 || rawLat > 90
    ) {
      return Response.json({ error: "Ugyldig breddegrad (lat)" }, { status: 400 });
    }
    if (
      typeof rawLng !== "number" || !isFinite(rawLng) ||
      rawLng < -180 || rawLng > 180
    ) {
      return Response.json({ error: "Ugyldig længdegrad (lng)" }, { status: 400 });
    }
    lat = rawLat;
    lng = rawLng;
  }

  // Validate photo_urls — max 5, each must match path pattern
  let photo_urls: string[] = [];
  if (Array.isArray(body.photo_urls)) {
    if (body.photo_urls.length > 5) {
      return Response.json({ error: "Maks 5 billeder" }, { status: 400 });
    }
    for (const p of body.photo_urls) {
      if (typeof p !== "string" || !PHOTO_PATH_REGEX.test(p)) {
        return Response.json(
          { error: "Ugyldigt billede-sti format" },
          { status: 400 }
        );
      }
    }
    photo_urls = body.photo_urls;
  }

  // Sanitise facilities
  let facilities: Partial<Record<FacilityKey, boolean>> | null = null;
  if (body.facilities && typeof body.facilities === "object") {
    facilities = {};
    for (const key of FACILITY_KEYS) {
      if (key in body.facilities) {
        facilities[key] = Boolean(body.facilities[key]);
      }
    }
    if (Object.keys(facilities).length === 0) facilities = null;
  }

  // Optional numeric fields
  const capacity =
    typeof body.capacity === "number" && body.capacity > 0
      ? Math.floor(body.capacity)
      : null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("shelter_submissions").insert({
    type,
    shelter_name,
    location_text,
    lat,
    lng,
    photo_urls,
    capacity,
    description: body.description?.trim() || null,
    facilities,
    booking_url: body.booking_url?.trim() || null,
    contact_name: body.contact_name?.trim() || null,
    contact_email,
    source_info,
  });

  if (error) {
    console.error("shelter_submissions insert:", error);
    return Response.json({ error: "Kunne ikke gemme. Prøv igen." }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 2: Run full tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/submit-shelter/route.ts
git commit -m "feat: accept lat/lng/photo_urls in submit-shelter route"
```

---

## Task 6: Update Pending Submissions GET Route

**Files:**
- Modify: `app/api/admin/pending-shelter-submissions/route.ts`

Add the new columns to the SELECT and generate 60-minute signed preview URLs for each submission's photos so the admin can view them as thumbnails.

- [ ] **Step 1: Rewrite the route to include new columns and signed photo URLs**

Replace the full file:

```typescript
// web/app/api/admin/pending-shelter-submissions/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shelter_submissions")
    .select(
      "id, type, status, shelter_name, location_text, lat, lng, photo_urls, capacity, description, facilities, booking_url, contact_name, contact_email, source_info, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message).includes("shelter_submissions")) {
      return Response.json({ submissions: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  const submissions = data ?? [];

  // Generate signed 60-min preview URLs for each submission's photos (private bucket)
  const withPreviewUrls = await Promise.all(
    submissions.map(async (sub) => {
      const paths: string[] = Array.isArray(sub.photo_urls) ? sub.photo_urls : [];
      if (paths.length === 0) return { ...sub, photo_preview_urls: [] };

      const previewUrls = await Promise.all(
        paths.map(async (path) => {
          const { data: signed } = await supabase.storage
            .from("shelter-submissions")
            .createSignedUrl(path, 3600);
          return signed?.signedUrl ?? null;
        })
      );
      return { ...sub, photo_preview_urls: previewUrls };
    })
  );

  return Response.json({ submissions: withPreviewUrls });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/pending-shelter-submissions/route.ts
git commit -m "feat: include lat/lng/photo_urls + signed preview URLs in pending-shelter-submissions"
```

---

## Task 7: Extend Approve Route

**Files:**
- Modify: `app/api/admin/approve-shelter-submission/route.ts`

This is the most complex task. It creates the shelter in `shelters`, copies photos between buckets, and sends approval email.

Slug generation: `slugifySegment(shelter_name) + '-' + crypto.randomUUID().slice(0, 6)` — uses the existing `slugifySegment` from `@/lib/slug`.

- [ ] **Step 1: Write the extended approve route**

Replace the full file:

```typescript
// web/app/api/admin/approve-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { slugifySegment } from "@/lib/slug";
import { sendShelterApprovedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    submissionId?: string;
    region?: string;
    kommune?: string;
    place?: string;
    lat?: number;
    lng?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId || !UUID_REGEX.test(submissionId)) {
    return Response.json({ error: "Mangler eller ugyldigt submissionId" }, { status: 400 });
  }

  const region = body.region?.trim();
  if (!region) {
    return Response.json({ error: "Region er påkrævet" }, { status: 400 });
  }

  const lat = body.lat;
  const lng = body.lng;
  if (typeof lat !== "number" || !isFinite(lat) || lat < -90 || lat > 90) {
    return Response.json({ error: "Ugyldig lat" }, { status: 400 });
  }
  if (typeof lng !== "number" || !isFinite(lng) || lng < -180 || lng > 180) {
    return Response.json({ error: "Ugyldig lng" }, { status: 400 });
  }

  const kommune = body.kommune?.trim() || null;
  const place = body.place?.trim() || null;

  const supabase = createAdminClient();

  // Fetch submission
  const { data: submission, error: fetchError } = await supabase
    .from("shelter_submissions")
    .select(
      "id, shelter_name, description, capacity, facilities, booking_url, contact_email, photo_urls"
    )
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !submission) {
    return Response.json({ error: "Ansøgning ikke fundet" }, { status: 404 });
  }

  // Generate unique slug
  const newShelterId = crypto.randomUUID();
  const slugBase = slugifySegment(submission.shelter_name);
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  // Copy photos from shelter-submissions bucket to shelter-photos bucket
  const submissionsBucket = "shelter-submissions";
  const photosBucket = "shelter-photos";
  const reuploadedUrls: string[] = [];
  const reuploadedPaths: string[] = []; // track storage paths for cleanup logging

  const photoPaths: string[] = Array.isArray(submission.photo_urls)
    ? submission.photo_urls
    : [];

  for (const storagePath of photoPaths) {
    try {
      // Download from submissions bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(submissionsBucket)
        .download(storagePath);

      if (downloadError || !fileData) {
        console.error(`Photo download failed for ${storagePath}:`, downloadError);
        continue;
      }

      // Re-upload to shelter-photos bucket
      const ext = storagePath.split(".").pop() ?? "jpg";
      const newPath = `owner/${newShelterId}/${crypto.randomUUID()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : "image/jpeg";

      const { error: uploadError } = await supabase.storage
        .from(photosBucket)
        .upload(newPath, fileData, { contentType, upsert: false });

      if (uploadError) {
        console.error(`Photo re-upload failed for ${storagePath}:`, uploadError);
        continue;
      }

      // Build public URL for shelter-photos (public bucket)
      const { data: urlData } = supabase.storage
        .from(photosBucket)
        .getPublicUrl(newPath);
      reuploadedUrls.push(urlData.publicUrl);
      reuploadedPaths.push(newPath); // track path for cleanup if insert fails
    } catch (err) {
      console.error(`Unexpected error copying photo ${storagePath}:`, err);
    }
  }

  // Build geofa_raw from facilities
  const facilities =
    (submission.facilities as Partial<Record<string, boolean>> | null) ?? {};
  const geofa_raw: Record<string, string> = {};
  if (facilities.baalplads) geofa_raw.baalplads = "Ja";
  if (facilities.hunde_tilladt) geofa_raw.hunde_tilladt = "Ja";

  // Insert shelter — POINT(lng lat) plain text format (parsed by regex on site)
  const location = `POINT(${lng} ${lat})`;

  const { error: insertError } = await supabase.from("shelters").insert({
    id: newShelterId,
    title: submission.shelter_name,
    slug,
    description: submission.description || null,
    location,
    region,
    kommune: kommune || null,
    place: place || null,
    water: facilities.vand ?? false,
    toilet: facilities.toilet ?? false,
    capacity: submission.capacity || null,
    booking_url: submission.booking_url || null,
    user_image_urls: reuploadedUrls.length > 0 ? { urls: reuploadedUrls } : null,
    geofa_raw: Object.keys(geofa_raw).length > 0 ? geofa_raw : null,
  });

  if (insertError) {
    console.error("Shelter insert error:", insertError);
    if (reuploadedPaths.length > 0) {
      console.error(
        `Orphaned photos in shelter-photos bucket for shelter ${newShelterId}:`,
        reuploadedPaths
      );
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Update submission status + shelter_id reference
  await supabase
    .from("shelter_submissions")
    .update({
      status: "approved",
      shelter_id: newShelterId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  // Send approval email
  if (submission.contact_email) {
    try {
      await sendShelterApprovedEmail({
        toEmail: submission.contact_email,
        shelterName: submission.shelter_name,
        shelterSlug: slug,
        submissionId,
      });
    } catch (emailErr) {
      console.error("Approval email failed:", emailErr);
      return Response.json(
        { ok: true, shelterId: newShelterId, slug, warning: "Shelter oprettet men email fejlede" },
        { status: 200 }
      );
    }
  }

  return Response.json({ ok: true, shelterId: newShelterId, slug });
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/approve-shelter-submission/route.ts
git commit -m "feat: approve route creates shelter, copies photos, sends approval email"
```

---

## Task 8: Extend Reject Route

**Files:**
- Modify: `app/api/admin/reject-shelter-submission/route.ts`

Add storage cleanup and rejection email.

- [ ] **Step 1: Write the extended reject route**

Replace the full file:

```typescript
// web/app/api/admin/reject-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendShelterRejectedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { submissionId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId || !UUID_REGEX.test(submissionId)) {
    return Response.json({ error: "Mangler eller ugyldigt submissionId" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return Response.json({ error: "Årsag til afvisning er påkrævet" }, { status: 400 });
  }
  if (reason.length > 1000) {
    return Response.json({ error: "Årsag må højst være 1000 tegn" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch submission to get photo_urls and contact info
  const { data: submission, error: fetchError } = await supabase
    .from("shelter_submissions")
    .select("id, shelter_name, contact_email, photo_urls")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !submission) {
    return Response.json({ error: "Ansøgning ikke fundet" }, { status: 404 });
  }

  // Update status first (so submission is off the pending list)
  const { error: updateError } = await supabase
    .from("shelter_submissions")
    .update({
      status: "rejected",
      rejected_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending"); // idempotency guard

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Delete photos from shelter-submissions bucket
  const photoPaths: string[] = Array.isArray(submission.photo_urls)
    ? submission.photo_urls
    : [];

  for (const storagePath of photoPaths) {
    const { error: removeError } = await supabase.storage
      .from("shelter-submissions")
      .remove([storagePath]);
    if (removeError) {
      console.error(`Failed to delete photo ${storagePath}:`, removeError);
    }
  }

  // Send rejection email
  if (submission.contact_email) {
    try {
      await sendShelterRejectedEmail({
        toEmail: submission.contact_email,
        shelterName: submission.shelter_name,
        reason,
        submissionId,
      });
    } catch (emailErr) {
      console.error("Rejection email failed:", emailErr);
      // Submission already rejected — log and continue
    }
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/reject-shelter-submission/route.ts
git commit -m "feat: reject route deletes photos from storage and sends rejection email"
```

---

## Task 9: Public Submission Form

**Files:**
- Create: `components/ShelterSubmissionForm.tsx`
- Create: `app/(site)/opret-shelter/page.tsx`

The form has 4 sections. Map picker uses the same dynamic import + SSR:false pattern as `ShelterLocationMap.tsx`. Photo upload calls `POST /api/submit-shelter/photos` immediately on file selection.

- [ ] **Step 1: Create the Leaflet map picker component (inline in ShelterSubmissionForm)**

The map component is defined inside the same file using dynamic import:

```typescript
// Inside ShelterSubmissionForm.tsx — defined at module level, used in section 2
const SubmissionMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMapEvents } = await import("react-leaflet");
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({
          click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }

      const center: [number, number] = lat != null && lng != null
        ? [lat, lng]
        : [56.0, 10.0]; // Denmark center

      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 300, width: "100%" }}
          className="rounded-xl z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);
```

- [ ] **Step 2: Write the full ShelterSubmissionForm component**

Create `components/ShelterSubmissionForm.tsx`:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { FACILITY_KEYS, FACILITY_LABELS } from "@/lib/shelter-submissions";
import type { FacilityKey } from "@/lib/shelter-submissions";

// ─── Leaflet map picker (SSR disabled) ────────────────────────────────────────

const SubmissionMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMapEvents } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({
          click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }

      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [56.0, 10.0];

      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 300, width: "100%" }}
          className="rounded-xl z-0 [&_.leaflet-control-attribution]:text-[10px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedPhoto {
  path: string;
  previewUrl: string | null;
}

// ─── Main form component ──────────────────────────────────────────────────────

export function ShelterSubmissionForm() {
  // Section 1 — Om shelteret
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  // Section 2 — Placering på kort
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Section 3 — Faciliteter
  const [facilities, setFacilities] = useState<Partial<Record<FacilityKey, boolean>>>({});

  // Section 4 — Billeder + kontakt
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ─── Photo upload ────────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = ""; // reset so same file can be re-selected

    if (!file) return;

    if (photos.length >= 5) {
      setPhotoError("Maks 5 billeder");
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/submit-shelter/photos", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.error ?? "Upload fejlede");
        return;
      }
      setPhotos((prev) => [
        ...prev,
        { path: data.path, previewUrl: data.previewUrl },
      ]);
    } catch {
      setPhotoError("Upload fejlede — prøv igen");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Client-side validation
    if (!shelterName.trim()) {
      setSubmitError("Shelterets navn er påkrævet");
      return;
    }
    if (!locationText.trim()) {
      setSubmitError("Stedsbeskrivelse er påkrævet");
      return;
    }
    if (!contactEmail.trim()) {
      setSubmitError("Email er påkrævet");
      return;
    }
    if (bookingUrl.trim() && !/^https?:\/\//.test(bookingUrl.trim())) {
      setSubmitError("Booking-URL skal starte med http:// eller https://");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner_registration",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          lat,
          lng,
          capacity: capacity ? Number(capacity) : undefined,
          description: description.trim() || undefined,
          facilities,
          booking_url: bookingUrl.trim() || undefined,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim(),
          photo_urls: photos.map((p) => p.path),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Noget gik galt — prøv igen");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Netværksfejl — tjek din forbindelse og prøv igen");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-3xl mb-3">🏕️</div>
        <h2 className="text-xl font-semibold text-green-800 mb-2">Tak for din ansøgning!</h2>
        <p className="text-green-700 text-sm">
          Vi gennemgår dit shelter og vender tilbage til dig på <strong>{contactEmail}</strong>.
        </p>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Section 1: Om shelteret */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">1. Om shelteret</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Shelterens navn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shelterName}
              onChange={(e) => setShelterName(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx Skovhytten ved Esrum Sø"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Stedsbeskrivelse <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx Gribskov, tæt på Esrum Sø"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Kapacitet (antal personer)
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min={1}
              className="w-32 rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx 6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Beskrivelse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
              placeholder="Beskriv shelteret..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Booking-URL
            </label>
            <input
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      {/* Section 2: Placering på kort */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-2">2. Placering på kort</h2>
        <p className="text-sm text-primary/60 mb-3">Klik på kortet for at sætte en pin.</p>
        <div className="rounded-xl overflow-hidden border border-primary/10 mb-3">
          <SubmissionMapPicker
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </div>
        {lat != null && lng != null ? (
          <p className="text-xs text-primary/50">
            Koordinater: {lat.toFixed(5)}, {lng.toFixed(5)}
            <button
              type="button"
              onClick={() => { setLat(null); setLng(null); }}
              className="ml-2 text-red-400 hover:text-red-600 underline"
            >
              Fjern pin
            </button>
          </p>
        ) : (
          <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-700">
            Ingen pin sat — admin vil sætte koordinater ved gennemgang.
          </p>
        )}
      </section>

      {/* Section 3: Faciliteter */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-3">3. Faciliteter</h2>
        <div className="flex flex-wrap gap-3">
          {FACILITY_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!facilities[key]}
                onChange={(e) =>
                  setFacilities((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                className="rounded border-primary/30 accent-accent"
              />
              <span className="text-sm text-primary/80">{FACILITY_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Section 4: Billeder + kontakt */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">4. Billeder og kontakt</h2>
        <div className="space-y-4">
          {/* Photo upload */}
          <div>
            <p className="text-sm font-medium text-primary/80 mb-2">
              Billeder (valgfrit, maks 5 stk., JPEG/PNG, maks 5 MB pr. billede)
            </p>
            <div className="flex flex-wrap gap-3 mb-3">
              {photos.map((photo, i) => (
                <div key={photo.path} className="relative w-20 h-20">
                  {photo.previewUrl ? (
                    <img
                      src={photo.previewUrl}
                      alt={`Billede ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-primary/10"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs text-primary/40">
                      📷
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                    aria-label="Fjern billede"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:border-accent hover:text-accent transition-colors text-xs gap-1 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <span>...</span>
                  ) : (
                    <>
                      <span className="text-lg">+</span>
                      <span>Tilføj</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileSelect}
            />
            {photoError && (
              <p className="text-xs text-red-500 mt-1">{photoError}</p>
            )}
          </div>

          {/* Contact fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary/80 mb-1">
                Dit navn
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="Valgfrit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary/80 mb-1">
                Din email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="du@eksempel.dk"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Error + Submit */}
      {submitError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-accent text-white py-3 font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {submitting ? "Sender..." : "Send ansøgning"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create the page wrapper**

Create `app/(site)/opret-shelter/page.tsx`:

```typescript
import type { Metadata } from "next";
import { ShelterSubmissionForm } from "@/components/ShelterSubmissionForm";

export const metadata: Metadata = {
  title: "Opret shelter | ShelterDK",
  description:
    "Har du et shelter du vil have listet på ShelterDK? Indsend det her — vi gennemgår din ansøgning og vender tilbage.",
  robots: "noindex",
};

export default function OpretShelterPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <a href="/" className="hover:text-accent transition-colors">
          Hjem
        </a>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Opret shelter</span>
      </nav>

      <h1 className="text-2xl font-bold text-primary mb-2">Opret shelter</h1>
      <p className="text-sm text-primary/60 mb-8">
        Udfyld formularen herunder for at indsende dit shelter til ShelterDK.
        Vi gennemgår ansøgningen og vender tilbage til dig på den angivne email.
      </p>

      <ShelterSubmissionForm />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add components/ShelterSubmissionForm.tsx app/(site)/opret-shelter/page.tsx
git commit -m "feat: public shelter submission form at /opret-shelter"
```

---

## Task 10: Admin Review UI

**Files:**
- Create: `app/(site)/admin/shelter-ansogninger/page.tsx`

Follow the same "use client" + sessionStorage secret pattern as `admin/redirects/page.tsx` and `admin/kontakt/page.tsx`.

The page:
1. Fetches pending submissions on mount
2. Shows each as a card (name, location, date, photo count)
3. Clicking "Gennemgå" expands an inline review panel
4. Review panel: all fields, photos, draggable Leaflet map, region/kommune/place inputs, Approve/Reject buttons

- [ ] **Step 1: Create the admin review page**

Create `app/(site)/admin/shelter-ansogninger/page.tsx`:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { ShelterSubmission, FacilityKey } from "@/lib/shelter-submissions";
import { FACILITY_LABELS } from "@/lib/shelter-submissions";

const STORAGE_KEY = "shelterdk-admin-secret";

// ─── Leaflet admin review map ──────────────────────────────────────────────

const AdminMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMapEvents } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng); } });
        return null;
      }
      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [56.0, 10.0];
      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 250, width: "100%" }}
          className="rounded-xl z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

// ─── Types ─────────────────────────────────────────────────────────────────

type Submission = ShelterSubmission & {
  photo_urls: string[];
  photo_preview_urls: (string | null)[];
};

// ─── Main page component ────────────────────────────────────────────────────

export default function ShelterAnsogningerPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY) ?? ""
      : ""
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Review panel state per submission
  const [reviewLat, setReviewLat] = useState<number | null>(null);
  const [reviewLng, setReviewLng] = useState<number | null>(null);
  const [region, setRegion] = useState("");
  const [kommune, setKommune] = useState("");
  const [place, setPlace] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectField, setShowRejectField] = useState(false);
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-secret": secret }),
    [secret]
  );

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/pending-shelter-submissions", {
        headers: { "x-admin-secret": secret },
      });
      if (res.status === 401) { setAuthError(true); setLoading(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ukendt fejl");
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl ved indlæsning");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openReview(sub: Submission) {
    setExpandedId(sub.id);
    setReviewLat(sub.lat);
    setReviewLng(sub.lng);
    setRegion("");
    setKommune("");
    setPlace("");
    setRejectReason("");
    setShowRejectField(false);
  }

  function closeReview() {
    setExpandedId(null);
    setShowRejectField(false);
  }

  async function handleApprove(sub: Submission) {
    if (!region.trim()) return;
    if (reviewLat == null || reviewLng == null) {
      setBanner({ type: "err", msg: "Sæt koordinater på kortet før godkendelse" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/approve-shelter-submission", {
        method: "POST",
        headers,
        body: JSON.stringify({
          submissionId: sub.id,
          region: region.trim(),
          kommune: kommune.trim(),
          place: place.trim(),
          lat: reviewLat,
          lng: reviewLng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Godkendelse fejlede");
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      closeReview();
      setBanner({ type: "ok", msg: `✅ ${sub.shelter_name} er nu live!` });
      if (data.warning) setBanner({ type: "err", msg: data.warning });
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Fejl" });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(sub: Submission) {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reject-shelter-submission", {
        method: "POST",
        headers,
        body: JSON.stringify({ submissionId: sub.id, reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Afvisning fejlede");
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      closeReview();
      setBanner({ type: "ok", msg: `Ansøgning fra ${sub.shelter_name} afvist.` });
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Fejl" });
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600 text-sm">
          Ingen adgang — log ind med admin-nøglen på{" "}
          <Link href="/admin" className="underline">admin-siden</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Shelter-ansøgninger</span>
      </nav>

      <h1 className="text-2xl font-bold text-primary mb-6">Shelter-ansøgninger</h1>

      {banner && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            banner.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {banner.msg}
          <button
            onClick={() => setBanner(null)}
            className="ml-3 text-xs underline opacity-70"
          >
            Luk
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-primary/50">Indlæser...</p>}
      {errorMsg && (
        <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
      )}

      {!loading && submissions.length === 0 && (
        <p className="text-sm text-primary/50">Ingen afventende ansøgninger.</p>
      )}

      <div className="space-y-4">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-xl border border-primary/10 bg-white overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-semibold text-primary">{sub.shelter_name}</p>
                <p className="text-xs text-primary/50 mt-0.5">
                  {sub.location_text} ·{" "}
                  {new Date(sub.created_at).toLocaleDateString("da-DK")}
                  {sub.photo_urls.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-primary/5 rounded px-1.5 py-0.5 text-primary/60">
                      📷 {sub.photo_urls.length}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  expandedId === sub.id ? closeReview() : openReview(sub)
                }
                className="text-sm text-accent hover:underline font-medium"
              >
                {expandedId === sub.id ? "Luk" : "Gennemgå"}
              </button>
            </div>

            {/* Expanded review panel */}
            {expandedId === sub.id && (
              <div className="border-t border-primary/10 px-5 pb-6 pt-5 space-y-5">
                {/* Submission details */}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-primary/50 text-xs">Type</dt>
                    <dd className="text-primary">{sub.type}</dd>
                  </div>
                  <div>
                    <dt className="text-primary/50 text-xs">Kapacitet</dt>
                    <dd className="text-primary">{sub.capacity ?? "—"}</dd>
                  </div>
                  {sub.booking_url && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Booking-URL</dt>
                      <dd>
                        <a href={sub.booking_url} target="_blank" rel="noreferrer" className="text-accent hover:underline text-xs">
                          {sub.booking_url}
                        </a>
                      </dd>
                    </div>
                  )}
                  {sub.contact_email && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Kontakt</dt>
                      <dd className="text-primary text-xs">
                        {sub.contact_name && <>{sub.contact_name} · </>}
                        {sub.contact_email}
                      </dd>
                    </div>
                  )}
                  {sub.description && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Beskrivelse</dt>
                      <dd className="text-primary text-xs whitespace-pre-wrap">{sub.description}</dd>
                    </div>
                  )}
                  {sub.facilities && Object.keys(sub.facilities).length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs mb-1">Faciliteter</dt>
                      <dd className="flex flex-wrap gap-2">
                        {(Object.entries(sub.facilities) as [FacilityKey, boolean][])
                          .filter(([, v]) => v)
                          .map(([k]) => (
                            <span key={k} className="text-xs bg-primary/5 rounded px-2 py-0.5">
                              {FACILITY_LABELS[k]}
                            </span>
                          ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Photos */}
                {sub.photo_urls.length > 0 && (
                  <div>
                    <p className="text-xs text-primary/50 mb-2">Billeder</p>
                    <div className="flex flex-wrap gap-2">
                      {sub.photo_urls.map((path, i) => {
                        const previewUrl = sub.photo_preview_urls?.[i];
                        return previewUrl ? (
                          <a
                            key={path}
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-primary/10 hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={previewUrl}
                              alt={`Billede ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ) : (
                          <div
                            key={path}
                            className="w-20 h-20 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs text-primary/40"
                          >
                            📷
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Map */}
                <div>
                  <p className="text-xs text-primary/50 mb-2">
                    Koordinater (klik på kortet for at justere)
                  </p>
                  <AdminMapPicker
                    lat={reviewLat}
                    lng={reviewLng}
                    onChange={(lat, lng) => { setReviewLat(lat); setReviewLng(lng); }}
                  />
                  {reviewLat != null && reviewLng != null && (
                    <p className="text-xs text-primary/40 mt-1">
                      {reviewLat.toFixed(5)}, {reviewLng.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Admin classification fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">
                      Region <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="fx Sjælland"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">Kommune</label>
                    <input
                      value={kommune}
                      onChange={(e) => setKommune(e.target.value)}
                      placeholder="fx Gribskov"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">Sted</label>
                    <input
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="fx Gribskov"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Approve / Reject buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => handleApprove(sub)}
                    disabled={busy || !region.trim() || reviewLat == null}
                    className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                  >
                    {busy ? "Gemmer..." : "✅ Godkend"}
                  </button>
                  <button
                    onClick={() => setShowRejectField(true)}
                    disabled={busy}
                    className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    ❌ Afvis
                  </button>
                </div>

                {/* Reject reason */}
                {showRejectField && (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Angiv årsag til afvisning (sendes til ansøger)..."
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-y"
                    />
                    <button
                      onClick={() => handleReject(sub)}
                      disabled={busy || !rejectReason.trim()}
                      className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      {busy ? "Afviser..." : "Send afvisning"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/(site)/admin/shelter-ansogninger/page.tsx
git commit -m "feat: admin shelter-ansogninger review UI"
```

---

## Task 11: Admin Index Link

**Files:**
- Modify: `app/(site)/admin/page.tsx`

- [ ] **Step 1: Add link**

Add after the `💬 Kontaktbeskeder` link:

```tsx
<Link
  href="/admin/shelter-ansogninger"
  className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
>
  🏕️ Shelter-ansøgninger
</Link>
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/(site)/admin/page.tsx
git commit -m "feat: add Shelter-ansøgninger link to admin index"
```

---

## Final Verification

Run the full test suite one last time:

```bash
cd /Users/CKA/shelterdk/web && npx vitest run --reporter=verbose 2>&1
```

Then verify against the spec checklist:

1. `/opret-shelter` renders, all four sections visible, client-side validation works
2. Map picker: clicking sets pin + lat/lng readout; skipping shows yellow warning
3. Photo upload: selecting file uploads immediately, thumbnail appears, remove works
4. Submit with valid data → 201 → success screen shown
5. Submit without required fields → inline error
6. Admin `/admin/shelter-ansogninger` loads pending list
7. Expanding a submission shows all fields + map pin
8. Approve without region → button disabled
9. Approve with all fields → shelter appears in `/soeg` search results
10. Approval email arrives at contact_email
11. Reject with reason → submission removed from list
12. Rejection email arrives with reason
13. Photos cleaned up from `shelter-submissions` bucket on rejection
14. Admin index shows 🏕️ Shelter-ansøgninger link
