# Oplevelser Community Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anonymous users share photo + text experiences on shelter pages, auto-generate a branded share card, and extend the admin panel for moderation.

**Architecture:** Experiences are stored in a new `shelter_experiences` Supabase table. Photos upload to Supabase Storage via a server-issued presigned URL (anonymous client, no public write). The OG share card is a dynamic satori endpoint. The upload flow, shelter section, and homepage feed are client components that fetch from new API routes. Admin moderation reuses the existing `AdminPhotoReview` pattern.

**Tech Stack:** Next.js 14 App Router, Supabase (postgres + storage), Tailwind CSS, @vercel/og (satori), Vitest, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/migrations/20260418_shelter_experiences.sql` | Create | DB schema + RLS policies |
| `web/lib/experiences.ts` | Create | Types + client-safe helpers |
| `web/app/api/experiences/upload-url/route.ts` | Create | POST — issue presigned Storage URL |
| `web/app/api/experiences/route.ts` | Create | POST create, GET list by shelter |
| `web/app/api/experiences/recent/route.ts` | Create | GET recent across all shelters (homepage) |
| `web/app/api/og/oplevelse/[id]/route.ts` | Create | Dynamic OG card (satori) |
| `web/app/api/admin/pending-experiences/route.ts` | Create | GET pending experiences for admin |
| `web/app/api/admin/approve-experience/route.ts` | Create | POST approve experience |
| `web/app/api/admin/reject-experience/route.ts` | Create | POST reject experience |
| `web/components/ExperienceUploadModal.tsx` | Create | 3-step upload flow modal |
| `web/components/ShelterExperiencesSection.tsx` | Create | Experiences section on shelter page |
| `web/components/RecentExperiencesFeed.tsx` | Create | Homepage horizontal feed |
| `web/components/ShelterDetailContent.tsx` | Modify | Add `<ShelterExperiencesSection>` |
| `web/app/(site)/page.tsx` | Modify | Add `<RecentExperiencesFeed>` |
| `web/components/AdminPhotoReview.tsx` | Modify | Add "Oplevelser" tab |
| `web/app/api/experiences/__tests__/route.test.ts` | Create | Unit tests for experiences API |
| `web/app/api/experiences/__tests__/upload-url.test.ts` | Create | Unit tests for upload-url API |

---

## Task 1: Install @vercel/og and write the DB migration

**Files:**
- Create: `web/migrations/20260418_shelter_experiences.sql`
- Modify: `web/package.json` (dependency)

- [ ] **Step 1: Install @vercel/og**

```bash
cd web && npm install @vercel/og
```

Expected: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 1b: Create migrations directory**

```bash
mkdir -p web/migrations
```

- [ ] **Step 2: Write the migration SQL**

Create `web/migrations/20260418_shelter_experiences.sql`:

```sql
-- Enum for experience status
CREATE TYPE experience_status AS ENUM ('pending', 'approved', 'rejected');

-- Main table
CREATE TABLE shelter_experiences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id         UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  author_name        TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 60),
  body               TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  photo_urls         TEXT[] NOT NULL DEFAULT '{}',
  cover_photo_index  INTEGER NOT NULL DEFAULT 0 CHECK (cover_photo_index >= 0),
  status             experience_status NOT NULL DEFAULT 'pending',
  rejected_reason    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ
);

-- RLS: public can only read approved rows
ALTER TABLE shelter_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved"
  ON shelter_experiences FOR SELECT
  USING (status = 'approved');

-- Service role can do everything (used by API routes via createAdminClient)
-- No explicit policy needed — service_role bypasses RLS.

-- Index for shelter lookups
CREATE INDEX idx_shelter_experiences_shelter_id
  ON shelter_experiences (shelter_id)
  WHERE status = 'approved';

-- Index for admin pending queue
CREATE INDEX idx_shelter_experiences_pending
  ON shelter_experiences (created_at DESC)
  WHERE status = 'pending';
```

- [ ] **Step 3: Apply migration**

Run the SQL in the Supabase dashboard → SQL editor (paste the file contents and execute). Via Supabase CLI:

```bash
# If using Supabase CLI with managed migrations:
supabase db execute --file web/migrations/20260418_shelter_experiences.sql
```

Verify in the Supabase dashboard that `shelter_experiences` table exists with all columns.

- [ ] **Step 4: Create Storage bucket**

In the Supabase dashboard → Storage → New bucket:
- Name: `experience-photos`
- Public bucket: **yes** (public read — photos must be accessible for OG card and display)
- File size limit: 10 MB
- Allowed MIME types: `image/jpeg, image/png, image/webp`

Then set a bucket policy to block direct uploads (uploads go through presigned URLs only). In Storage → Policies → `experience-photos`:

```sql
-- Allow public reads
CREATE POLICY "Public read experience photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'experience-photos');

-- Deny direct inserts (uploads go through service_role presigned URLs)
-- No INSERT policy = inserts blocked for anon/authenticated roles.
```

- [ ] **Step 5: Commit**

```bash
git add web/migrations/20260418_shelter_experiences.sql web/package.json web/package-lock.json
git commit -m "feat(experiences): add DB migration, storage bucket, install @vercel/og"
```

---

## Task 2: Types and presigned upload URL route

**Files:**
- Create: `web/lib/experiences.ts`
- Create: `web/app/api/experiences/upload-url/route.ts`
- Create: `web/app/api/experiences/__tests__/upload-url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/app/api/experiences/__tests__/upload-url.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createAdminClient
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/utils/supabase/server-admin";
import { POST } from "../upload-url/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/experiences/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/experiences/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if fileCount is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 if fileCount > 4", async () => {
    const res = await POST(makeRequest({ fileCount: 5 }));
    expect(res.status).toBe(400);
  });

  it("returns presigned URLs for valid fileCount", async () => {
    const mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://example.com/signed", token: "tok", path: "abc/0.webp" },
            error: null,
          }),
        }),
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(mockStorageClient as ReturnType<typeof createAdminClient>);

    const res = await POST(makeRequest({ fileCount: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploads).toHaveLength(2);
    expect(body.experienceId).toBeTruthy();
    expect(body.uploads[0]).toMatchObject({ index: 0, signedUrl: expect.any(String), token: expect.any(String), path: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run app/api/experiences/__tests__/upload-url.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create types file**

Create `web/lib/experiences.ts`:

```typescript
export interface ShelterExperience {
  id: string;
  shelter_id: string;
  author_name: string;
  body: string;
  photo_urls: string[];
  cover_photo_index: number;
  status: "pending" | "approved" | "rejected";
  rejected_reason: string | null;
  created_at: string;
  approved_at: string | null;
}

/** Experience with joined shelter info — used in admin and feeds */
export interface ShelterExperienceWithShelter extends ShelterExperience {
  shelter: { title: string; slug: string } | null;
}

/** Payload for creating an experience */
export interface CreateExperiencePayload {
  experienceId: string;      // pre-allocated UUID from upload-url step
  shelter_id: string;
  author_name: string;
  body: string;
  photo_paths: string[];     // Storage paths returned by upload-url route
  cover_photo_index: number;
}

/** Returns the public Storage URL for a photo path */
export function experiencePhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/experience-photos/${path}`;
}

/** Truncates text to maxLen chars, appending "…" if needed */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
```

- [ ] **Step 4: Create upload-url route**

Create `web/app/api/experiences/upload-url/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILES = 4;
const BUCKET = "experience-photos";

/**
 * POST /api/experiences/upload-url
 * Body: { fileCount: number }  (1–4)
 *
 * Returns presigned upload URLs for each file plus the pre-allocated
 * experience UUID that must be passed to POST /api/experiences.
 */
export async function POST(request: NextRequest) {
  let body: { fileCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const fileCount = Number(body.fileCount);
  if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > MAX_FILES) {
    return Response.json(
      { error: `fileCount skal være 1–${MAX_FILES}` },
      { status: 400 }
    );
  }

  const experienceId = randomUUID();
  const supabase = createAdminClient();
  const storage = supabase.storage.from(BUCKET);

  const uploads: { index: number; signedUrl: string; path: string }[] = [];

  for (let i = 0; i < fileCount; i++) {
    const path = `${experienceId}/${i}.webp`;
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
    if (error || !data) {
      return Response.json(
        { error: "Kunne ikke oprette upload-URL: " + (error?.message ?? "ukendt fejl") },
        { status: 500 }
      );
    }
    // Expose token — required for uploadToSignedUrl on the client
    uploads.push({ index: i, signedUrl: data.signedUrl, token: data.token, path });
  }

  return Response.json({ experienceId, uploads });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npx vitest run app/api/experiences/__tests__/upload-url.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add web/lib/experiences.ts web/app/api/experiences/upload-url/route.ts web/app/api/experiences/__tests__/upload-url.test.ts
git commit -m "feat(experiences): types + presigned upload-url route"
```

---

## Task 3: Create and list experiences API

**Files:**
- Create: `web/app/api/experiences/route.ts`
- Create: `web/app/api/experiences/recent/route.ts`
- Create: `web/app/api/experiences/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/app/api/experiences/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/supabase/server-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/utils/supabase/server-public", () => ({ createPublicClient: vi.fn() }));

import { createAdminClient } from "@/utils/supabase/server-admin";
import { createPublicClient } from "@/utils/supabase/server-public";
import { POST, GET } from "../route";

function makePost(body: unknown) {
  return new Request("http://localhost/api/experiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/experiences");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url);
}

const validPayload = {
  experienceId: "00000000-0000-0000-0000-000000000001",
  shelter_id: "00000000-0000-0000-0000-000000000002",
  author_name: "Allan",
  body: "Fantastisk tur!",
  photo_paths: ["00000000-0000-0000-0000-000000000001/0.webp"],
  cover_photo_index: 0,
};

describe("POST /api/experiences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields missing", async () => {
    const res = await POST(makePost({ shelter_id: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when author_name too long", async () => {
    const res = await POST(makePost({ ...validPayload, author_name: "a".repeat(61) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body too long", async () => {
    const res = await POST(makePost({ ...validPayload, body: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("inserts experience and returns 201", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    } as ReturnType<typeof createAdminClient>);

    const res = await POST(makePost(validPayload));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

describe("GET /api/experiences", () => {
  it("returns 400 without shelter_id", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("returns experiences array", async () => {
    const fakeData = [{ id: "1", author_name: "Allan", body: "Test", photo_urls: [], cover_photo_index: 0, created_at: "2025-01-01" }];
    vi.mocked(createPublicClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: fakeData, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as ReturnType<typeof createPublicClient>);

    const res = await GET(makeGet({ shelter_id: "abc" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.experiences).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run app/api/experiences/__tests__/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create experiences route**

Create `web/app/api/experiences/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { CreateExperiencePayload } from "@/lib/experiences";
import { experiencePhotoUrl } from "@/lib/experiences";

export const dynamic = "force-dynamic";

const MAX_AUTHOR_LEN = 60;
const MAX_BODY_LEN = 500;
const MAX_PHOTOS = 4;

/**
 * POST /api/experiences
 * Creates a new experience in pending status.
 */
export async function POST(request: NextRequest) {
  let payload: Partial<CreateExperiencePayload>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const { experienceId, shelter_id, author_name, body, photo_paths, cover_photo_index } = payload;

  if (!experienceId || !shelter_id || !author_name || !body || !photo_paths) {
    return Response.json({ error: "Mangler påkrævede felter" }, { status: 400 });
  }
  if (typeof author_name !== "string" || author_name.trim().length === 0 || author_name.length > MAX_AUTHOR_LEN) {
    return Response.json({ error: "Ugyldigt forfatternavn" }, { status: 400 });
  }
  if (typeof body !== "string" || body.trim().length === 0 || body.length > MAX_BODY_LEN) {
    return Response.json({ error: "Tekst er for lang (maks 500 tegn)" }, { status: 400 });
  }
  if (!Array.isArray(photo_paths) || photo_paths.length === 0 || photo_paths.length > MAX_PHOTOS) {
    return Response.json({ error: "Ugyldigt antal billeder" }, { status: 400 });
  }
  const idx = cover_photo_index ?? 0;
  if (typeof idx !== "number" || idx < 0 || idx >= photo_paths.length) {
    return Response.json({ error: "Ugyldigt cover_photo_index" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const photo_urls = photo_paths.map((p: string) => experiencePhotoUrl(supabaseUrl, p));

  const supabase = createAdminClient();
  const { error } = await supabase.from("shelter_experiences").insert({
    id: experienceId,
    shelter_id,
    author_name: author_name.trim(),
    body: body.trim(),
    photo_urls,
    cover_photo_index: idx,
    status: "pending",
  });

  if (error) {
    return Response.json({ error: "Kunne ikke gemme oplevelse: " + error.message }, { status: 500 });
  }

  return Response.json({ ok: true, id: experienceId }, { status: 201 });
}

/**
 * GET /api/experiences?shelter_id=xxx[&limit=10]
 * Returns approved experiences for a shelter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shelter_id = searchParams.get("shelter_id");
  if (!shelter_id) {
    return Response.json({ error: "Mangler shelter_id" }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at")
    .eq("shelter_id", shelter_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ experiences: data ?? [] });
}
```

- [ ] **Step 4: Create recent experiences route**

Create `web/app/api/experiences/recent/route.ts`:

```typescript
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

/**
 * GET /api/experiences/recent?limit=8
 * Returns the most recent approved experiences across all shelters,
 * joined with shelter title and slug for the homepage feed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 20);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at, shelter:shelters(title, slug)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ experiences: [] });
  }

  return Response.json({ experiences: data ?? [] });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npx vitest run app/api/experiences/__tests__/route.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add web/app/api/experiences/route.ts web/app/api/experiences/recent/route.ts web/app/api/experiences/__tests__/route.test.ts
git commit -m "feat(experiences): create + list API routes"
```

---

## Task 4: OG share card endpoint

**Files:**
- Create: `web/app/api/og/oplevelse/[id]/route.ts`

> No unit test for this route — satori is not easily testable in vitest/jsdom. Manual visual testing is the validation method.

- [ ] **Step 1: Create the OG card route**

Create `web/app/api/og/oplevelse/[id]/route.ts`:

```typescript
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { truncate } from "@/lib/experiences";

export const runtime = "edge";

// Inter font must be bundled — place Inter-Regular.ttf in web/public/fonts/
async function loadFont(origin: string) {
  const res = await fetch(`${origin}/fonts/Inter-Regular.ttf`);
  return res.arrayBuffer();
}

/**
 * GET /api/og/oplevelse/[id]
 *
 * Generates a 1200×630 share card for a shelter experience.
 * Renders for both 'pending' and 'approved' statuses so users can
 * share immediately after submission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = new URL(request.url).origin;
  const { id } = params;

  // Fetch experience + shelter name (service role to see pending)
  const supabase = createAdminClient();
  const { data: exp, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at, status, shelter:shelters(title, region)")
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .single();

  if (error || !exp) {
    return new Response("Not found", { status: 404 });
  }

  const shelterTitle = (exp.shelter as { title: string; region: string } | null)?.title ?? "Shelter";
  const region = (exp.shelter as { title: string; region: string } | null)?.region ?? "";
  const coverUrl = exp.photo_urls?.[exp.cover_photo_index] ?? null;
  const extraPhotos = exp.photo_urls.length - 1;
  const bodyText = truncate(exp.body, 100);
  const date = new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });

  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await loadFont(origin);
  } catch {
    // Fallback: render without custom font
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          background: "#1a2e1a",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Background photo */}
        {coverUrl && (
          <img
            src={coverUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.88) 100%)",
            display: "flex",
          }}
        />

        {/* +N badge */}
        {extraPhotos > 0 && (
          <div
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              background: "rgba(0,0,0,0.55)",
              borderRadius: "20px",
              padding: "6px 16px",
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
            }}
          >
            +{extraPhotos} billeder
          </div>
        )}

        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "48px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Location */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.75)", fontSize: "20px" }}>
            <span>📍</span>
            <span>{shelterTitle}{region ? `, ${region}` : ""}</span>
          </div>

          {/* Quote */}
          <div style={{ color: "white", fontSize: "28px", fontStyle: "italic", lineHeight: 1.4, display: "flex" }}>
            "{bodyText}"
          </div>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px", display: "flex" }}>
              {exp.author_name} · {date}
            </div>
            <div
              style={{
                background: "#2d7a4e",
                borderRadius: "6px",
                padding: "8px 18px",
                color: "white",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                display: "flex",
              }}
            >
              shelterdk.dk
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, style: "normal", weight: 400 }]
        : [],
    }
  );
}
```

- [ ] **Step 2: Download Inter font**

```bash
# Download Inter-Regular from Google Fonts CDN and place in web/public/fonts/
mkdir -p web/public/fonts
curl -L "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" -o /tmp/inter.woff2
# Convert to ttf for satori (satori requires TTF/OTF, not WOFF2)
# Alternative: download TTF directly
curl -L "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -o /tmp/inter.zip 2>/dev/null || \
  echo "Download Inter TTF from https://github.com/rsms/inter/releases and place Inter-Regular.ttf in web/public/fonts/"
```

> **Note:** Satori requires TTF/OTF format. Download `Inter-Regular.ttf` from https://github.com/rsms/inter/releases and place at `web/public/fonts/Inter-Regular.ttf`. The OG card will render with system fonts as fallback if the file is missing.

- [ ] **Step 3: Test manually**

Start the dev server and visit:
```
http://localhost:3000/api/og/oplevelse/[id]
```
Replace `[id]` with a UUID from a `pending` or `approved` row in `shelter_experiences`. Verify the card renders correctly.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/og/oplevelse/ web/public/fonts/
git commit -m "feat(experiences): OG share card satori endpoint"
```

---

## Task 5: Admin moderation API routes

**Files:**
- Create: `web/app/api/admin/pending-experiences/route.ts`
- Create: `web/app/api/admin/approve-experience/route.ts`
- Create: `web/app/api/admin/reject-experience/route.ts`

These follow the exact same pattern as the existing `pending-community`, `approve-community`, `reject-community` routes. No new tests needed — same pattern already has coverage.

- [ ] **Step 1: Create pending-experiences route**

Create `web/app/api/admin/pending-experiences/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, shelter_id, author_name, body, photo_urls, cover_photo_index, status, created_at, shelter:shelters(title, slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message).includes("shelter_experiences")) {
      return Response.json({ experiences: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ experiences: data ?? [] });
}
```

- [ ] **Step 2: Create approve-experience route**

Create `web/app/api/admin/approve-experience/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { experienceId?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Ugyldig JSON" }, { status: 400 }); }

  const id = body.experienceId?.trim();
  if (!id) return Response.json({ error: "Mangler experienceId" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shelter_experiences")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Create reject-experience route**

Create `web/app/api/admin/reject-experience/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { experienceId?: string; reason?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Ugyldig JSON" }, { status: 400 }); }

  const id = body.experienceId?.trim();
  if (!id) return Response.json({ error: "Mangler experienceId" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shelter_experiences")
    .update({ status: "rejected", rejected_reason: body.reason?.trim() ?? null })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add web/app/api/admin/pending-experiences/route.ts web/app/api/admin/approve-experience/route.ts web/app/api/admin/reject-experience/route.ts
git commit -m "feat(experiences): admin moderation API routes"
```

---

## Task 6: ExperienceUploadModal component

**Files:**
- Create: `web/components/ExperienceUploadModal.tsx`

This is a client component. No unit tests — it's pure UI with fetch calls. Test manually in the browser.

- [ ] **Step 1: Create the modal**

Create `web/components/ExperienceUploadModal.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { X, Upload, ChevronRight, Copy, Check } from "lucide-react";

interface ExperienceUploadModalProps {
  shelterId: string;
  shelterSlug: string;
  shelterTitle: string;
  onClose: () => void;
}

type Step = "upload" | "text" | "done";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_FILES = 4;

export function ExperienceUploadModal({
  shelterId,
  shelterSlug,
  shelterTitle,
  onClose,
}: ExperienceUploadModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const valid: File[] = [];
    const errors: string[] = [];
    Array.from(selected).slice(0, MAX_FILES).forEach((f) => {
      if (!ACCEPTED.includes(f.type)) {
        errors.push(`${f.name}: kun JPEG, PNG, WebP`);
        return;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${f.name}: maks ${MAX_SIZE_MB} MB`);
        return;
      }
      valid.push(f);
    });
    if (errors.length) { setError(errors.join(" · ")); return; }
    setError(null);
    setFiles(valid);
    setCoverIndex(0);
    const readers = valid.map((f) => new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target?.result as string);
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(setPreviews);
  };

  const handleSubmit = async () => {
    if (!authorName.trim()) { setError("Skriv dit fornavn"); return; }
    if (!body.trim()) { setError("Skriv en kort tekst om din oplevelse"); return; }
    if (body.length > 500) { setError("Tekst må maks være 500 tegn"); return; }
    setSubmitting(true);
    setError(null);

    try {
      // 1. Get presigned upload URLs
      const urlRes = await fetch("/api/experiences/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileCount: files.length }),
      });
      if (!urlRes.ok) throw new Error("Kunne ikke starte upload");
      const { experienceId: eid, uploads } = await urlRes.json();

      // 2. Upload each file via Supabase signed URL
      // Must use uploadToSignedUrl (not a raw PUT) — Supabase Storage requires the SDK method
      const { createBrowserSupabaseClient } = await import("@/utils/supabase/browser");
      const supabase = createBrowserSupabaseClient();
      await Promise.all(
        uploads.map(async (u: { index: number; signedUrl: string; token: string; path: string }, i: number) => {
          const { error: upErr } = await supabase.storage
            .from("experience-photos")
            .uploadToSignedUrl(u.path, u.token, files[i], { contentType: files[i].type });
          if (upErr) throw new Error(`Upload fejlede for billede ${i + 1}: ${upErr.message}`);
        })
      );

      // 3. Create experience record
      const photoPaths = uploads.map((u: { path: string }) => u.path);
      const createRes = await fetch("/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: eid,
          shelter_id: shelterId,
          author_name: authorName.trim(),
          body: body.trim(),
          photo_paths: photoPaths,
          cover_photo_index: coverIndex,
        }),
      });
      if (!createRes.ok) throw new Error("Kunne ikke gemme oplevelse");

      setExperienceId(eid);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noget gik galt, prøv igen");
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/shelter/${shelterSlug}`;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/10">
          <div>
            <div className="font-semibold text-primary text-base">Del din oplevelse</div>
            <div className="text-xs text-primary/50">{shelterTitle}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-primary/50 hover:text-primary hover:bg-primary/5 touch-manipulation">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Step: upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
              >
                <Upload className="w-8 h-8 text-primary/30" />
                <div className="text-sm font-medium text-primary/60">Klik for at vælge fotos</div>
                <div className="text-xs text-primary/40">JPEG, PNG, WebP · maks 10 MB · op til 4 billeder</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {previews.length > 0 && (
                <div>
                  <div className="text-xs text-primary/50 mb-2">Klik for at vælge forsidebillede</div>
                  <div className="flex gap-2 flex-wrap">
                    {previews.map((src, i) => (
                      <div
                        key={i}
                        onClick={() => setCoverIndex(i)}
                        className={`relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${i === coverIndex ? "border-accent shadow-md" : "border-transparent"}`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {i === coverIndex && (
                          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-accent" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

              <button
                onClick={() => files.length > 0 ? setStep("text") : fileRef.current?.click()}
                disabled={files.length === 0}
                className="w-full bg-accent text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 touch-manipulation"
              >
                Næste <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step: text */}
          {step === "text" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-primary/60 uppercase tracking-wide block mb-1.5">Dit fornavn</label>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={60}
                  placeholder="Fx Allan"
                  className="w-full border border-primary/15 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary/60 uppercase tracking-wide block mb-1.5">Din oplevelse</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Fortæl kort om din tur..."
                  className="w-full border border-primary/15 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:border-accent/50 resize-none"
                />
                <div className="text-xs text-primary/40 text-right mt-1">{body.length}/500</div>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-accent text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation"
              >
                {submitting ? "Sender…" : "Indsend oplevelse"}
              </button>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && experienceId && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-primary mb-1">Tak for din oplevelse!</div>
                <div className="text-sm text-primary/60">Din oplevelse vises snart, når den er godkendt. Del den allerede nu i Facebook-gruppen.</div>
              </div>

              {/* OG card preview */}
              <div className="rounded-xl overflow-hidden border border-primary/10">
                <img
                  src={`/api/og/oplevelse/${experienceId}`}
                  alt="Dit share-kort"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 border border-primary/15 rounded-xl py-3 text-sm font-medium text-primary hover:bg-primary/5 touch-manipulation"
                >
                  {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                  {copied ? "Kopieret!" : "Kopiér link"}
                </button>
                <a
                  href={fbShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#1877f2] text-white rounded-xl py-3 text-sm font-semibold touch-manipulation"
                >
                  Del i Facebook-gruppen
                </a>
                <div className="text-xs text-primary/40">Åbner Facebook — vælg gruppen "Shelters i Danmark" og indsæt linket</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual test in browser**

1. Start dev server: `cd web && npm run dev`
2. Navigate to a shelter page that has the section (after Task 7)
3. Click "Del din oplevelse"
4. Upload a photo, enter name + text, submit
5. Verify the confirmation screen shows the OG card image
6. Verify the "Kopiér link" button works
7. Check Supabase dashboard → `shelter_experiences` table has a new `pending` row

- [ ] **Step 3: Commit**

```bash
git add web/components/ExperienceUploadModal.tsx
git commit -m "feat(experiences): upload modal component (3-step flow)"
```

---

## Task 7: Shelter page integration

**Files:**
- Create: `web/components/ShelterExperiencesSection.tsx`
- Modify: `web/components/ShelterDetailContent.tsx`

- [ ] **Step 1: Create ShelterExperiencesSection**

Create `web/components/ShelterExperiencesSection.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { ExperienceUploadModal } from "@/components/ExperienceUploadModal";
import type { ShelterExperience } from "@/lib/experiences";

interface ShelterExperiencesSectionProps {
  shelterId: string;
  shelterSlug: string;
  shelterTitle: string;
}

export function ShelterExperiencesSection({
  shelterId,
  shelterSlug,
  shelterTitle,
}: ShelterExperiencesSectionProps) {
  const [experiences, setExperiences] = useState<ShelterExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/experiences?shelter_id=${shelterId}`)
      .then((r) => r.json())
      .then((d) => setExperiences(d.experiences ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shelterId]);

  return (
    <section className="mt-8 pt-8 border-t border-primary/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Oplevelser</h2>
          {!loading && (
            <p className="text-sm text-primary/50">
              {experiences.length > 0 ? `${experiences.length} besøg delt` : "Vær den første til at dele"}
            </p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent/90 transition-colors touch-manipulation"
        >
          <Camera size={15} />
          Del din oplevelse
        </button>
      </div>

      {loading && (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-48 h-36 rounded-xl bg-primary/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && experiences.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {experiences.map((exp) => {
            const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
            const extra = exp.photo_urls.length - 1;
            return (
              <div
                key={exp.id}
                className="flex-shrink-0 w-48 rounded-xl overflow-hidden border border-primary/10 bg-white"
              >
                {coverUrl ? (
                  <div className="relative h-28">
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    {extra > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        +{extra}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-28 bg-primary/5 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-primary/20" />
                  </div>
                )}
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-primary mb-0.5">{exp.author_name}</div>
                  <div className="text-xs text-primary/60 italic line-clamp-2">"{exp.body}"</div>
                  <div className="text-[10px] text-primary/30 mt-1.5">
                    {new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && experiences.length === 0 && (
        <div className="text-center py-8 px-4 bg-primary/[0.02] rounded-xl border border-dashed border-primary/10">
          <Camera className="w-8 h-8 text-primary/20 mx-auto mb-2" />
          <p className="text-sm text-primary/50">Ingen oplevelser endnu</p>
          <p className="text-xs text-primary/40 mt-1">Del et billede og hjælp andre med at planlægge deres tur</p>
        </div>
      )}

      {modalOpen && (
        <ExperienceUploadModal
          shelterId={shelterId}
          shelterSlug={shelterSlug}
          shelterTitle={shelterTitle}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add section to ShelterDetailContent**

Find the end of the main content in `web/components/ShelterDetailContent.tsx`. Add import at top and component near the bottom of the content (after nearby shelters, before footer):

```tsx
// Add to imports at top of file:
import { ShelterExperiencesSection } from "@/components/ShelterExperiencesSection";

// Add inside the JSX, after the existing community contribution panel and before closing tags:
<ShelterExperiencesSection
  shelterId={shelter.id}
  shelterSlug={shelter.slug}
  shelterTitle={shelter.title}
/>
```

Find the right insertion point by looking for `CommunityContributionPanel` in the file — place `ShelterExperiencesSection` after it.

- [ ] **Step 3: Manual test**

1. Open any shelter page in the dev server
2. Verify the "Oplevelser" section renders (loading skeleton, then empty state)
3. Click "Del din oplevelse" — modal opens
4. Complete the upload flow
5. Approve the experience via Supabase dashboard (set `status = 'approved'`)
6. Reload the shelter page — experience appears in the section

- [ ] **Step 4: Commit**

```bash
git add web/components/ShelterExperiencesSection.tsx web/components/ShelterDetailContent.tsx
git commit -m "feat(experiences): shelter page oplevelser section"
```

---

## Task 8: Homepage "Seneste oplevelser" feed

**Files:**
- Create: `web/components/RecentExperiencesFeed.tsx`
- Modify: `web/app/(site)/page.tsx`

- [ ] **Step 1: Create RecentExperiencesFeed**

Create `web/components/RecentExperiencesFeed.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ShelterExperienceWithShelter } from "@/lib/experiences";

export function RecentExperiencesFeed() {
  const [experiences, setExperiences] = useState<ShelterExperienceWithShelter[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/experiences/recent?limit=8")
      .then((r) => r.json())
      .then((d) => {
        setExperiences(d.experiences ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Don't render section if no experiences yet
  if (loaded && experiences.length === 0) return null;

  return (
    <section className="py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-primary">Seneste oplevelser</h2>
            <p className="text-sm text-primary/50 mt-0.5">Hvad andre har oplevet denne uge</p>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {!loaded
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-52 rounded-xl bg-primary/5 animate-pulse h-44" />
              ))
            : experiences.map((exp) => {
                const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
                const shelter = exp.shelter as { title: string; slug: string } | null;
                return (
                  <Link
                    key={exp.id}
                    href={shelter ? `/shelter/${shelter.slug}` : "/soeg"}
                    className="flex-shrink-0 w-52 rounded-xl overflow-hidden border border-primary/10 bg-white hover:shadow-md transition-shadow"
                  >
                    {coverUrl ? (
                      <div className="h-28 relative">
                        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-2.5 right-2.5">
                          <div className="text-[10px] text-white/80">📍 {shelter?.title ?? "Shelter"}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-primary/5 flex items-center justify-center">
                        <div className="text-xs text-primary/30">📷</div>
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-xs italic text-primary/60 line-clamp-2">"{exp.body}"</div>
                      <div className="text-[10px] text-primary/30 mt-1.5">
                        {exp.author_name} · {new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to homepage**

In `web/app/(site)/page.tsx`, add the import and the component. Place it after the main shelter grid and before the Instagram feed:

```tsx
// Add to imports (use dynamic import — client component):
const RecentExperiencesFeed = dynamic(
  () => import("@/components/RecentExperiencesFeed").then((m) => ({ default: m.RecentExperiencesFeed })),
  { ssr: false }
);

// Add in JSX after <FrontPageShelterGrid ... /> and before <InstagramFeed>:
<RecentExperiencesFeed />
```

- [ ] **Step 3: Manual test**

1. Approve at least one experience in Supabase dashboard
2. Visit the homepage — "Seneste oplevelser" feed appears
3. With no approved experiences, the section is hidden (returns `null`)

- [ ] **Step 4: Commit**

```bash
git add web/components/RecentExperiencesFeed.tsx web/app/(site)/page.tsx
git commit -m "feat(experiences): homepage seneste oplevelser feed"
```

---

## Task 9: Admin panel — Oplevelser tab

**Files:**
- Modify: `web/components/AdminPhotoReview.tsx`

- [ ] **Step 1: Add Experience type and tab to AdminPhotoReview**

In `web/components/AdminPhotoReview.tsx`, make these 5 targeted changes:

**Change 1** — Extend `TabKey` (line ~36):
```typescript
// Before:
type TabKey = "photos" | "community" | "instagram" | "newsletter" | "contact";
// After:
type TabKey = "photos" | "community" | "instagram" | "newsletter" | "contact" | "oplevelser";
```

**Change 2** — Add `Experience` type after the existing `ContactMessage` type (line ~87):
```typescript
type Experience = {
  id: string;
  shelter_id: string;
  author_name: string;
  body: string;
  photo_urls: string[];
  cover_photo_index: number;
  status: string;
  created_at: string;
  shelter: { title: string; slug: string } | null;
};
```

**Change 3** — Add to `TAB_CONFIG` array (line ~99, after the `"contact"` entry):
```typescript
  { key: "oplevelser", label: "Oplevelser", icon: Camera },
```

**Change 4** — Add `experiences` state alongside the other state declarations (line ~110, after `contactMsgs` state):
```typescript
const [experiences, setExperiences] = useState<Experience[]>([]);
```

**Change 5** — Add to `fetchAll` function (line ~150): add a parallel fetch alongside the existing five fetches in `Promise.all`, and handle the result:

In the `Promise.all` call, add:
```typescript
fetch(`/api/admin/pending-experiences?t=${ts}`, {
  headers: { "x-admin-secret": s },
  cache: "no-store",
}),
```

After the existing result handling (after `setContactMsgs`), add:
```typescript
// (destructure the new 6th result from Promise.all as experiencesRes)
if (experiencesRes.ok) {
  const expData = await experiencesRes.json();
  setExperiences(expData.experiences ?? []);
}
```

**Change 6** — Add the Oplevelser tab panel. The existing component renders tab content via a series of `{tab === "photos" && ...}` blocks. Add a new block at the end:

```tsx
{tab === "oplevelser" && (
  <div className="space-y-4">
    {loading && <div className="text-primary/60 text-sm">Henter…</div>}
    {!loading && experiences.length === 0 && (
      <div className="text-primary/50 text-sm py-8 text-center">Ingen ventende oplevelser</div>
    )}
    {experiences.map((exp) => {
      const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
      return (
        <div key={exp.id} className="border border-primary/10 rounded-xl overflow-hidden">
          <div className="flex gap-4 p-4">
            {coverUrl && (
              <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-primary">{exp.author_name}</div>
              <div className="text-xs text-primary/50 mb-1">{exp.shelter?.title ?? exp.shelter_id}</div>
              <div className="text-sm text-primary/70 italic line-clamp-3">"{exp.body}"</div>
              <div className="text-xs text-primary/30 mt-1">{new Date(exp.created_at).toLocaleString("da-DK")}</div>
            </div>
          </div>
          <div className="flex border-t border-primary/10">
            <button
              disabled={actingId === exp.id}
              onClick={async () => {
                setActingId(exp.id);
                await fetch("/api/admin/approve-experience", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                  body: JSON.stringify({ experienceId: exp.id }),
                });
                setActingId(null);
                fetchAll(secret);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              <Check size={15} /> Godkend
            </button>
            <div className="w-px bg-primary/10" />
            <button
              disabled={actingId === exp.id}
              onClick={async () => {
                const reason = prompt("Årsag til afvisning (valgfrit):");
                setActingId(exp.id);
                await fetch("/api/admin/reject-experience", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                  body: JSON.stringify({ experienceId: exp.id, reason }),
                });
                setActingId(null);
                fetchAll(secret);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X size={15} /> Afvis
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

Note: uses `secret` (not `adminSecret`), `tab` (not `activeTab`), `loading` (shared), `actingId` (shared), and `fetchAll(secret)` — all matching existing component variables.

- [ ] **Step 2: Manual test**

1. Navigate to `/admin/community` in dev server
2. Click the "Oplevelser" tab
3. Enter admin secret
4. Verify pending experiences appear
5. Approve one — verify it disappears from the list and appears on the shelter page

- [ ] **Step 3: Run full test suite**

```bash
cd web && npm test
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Commit and push**

```bash
git add web/components/AdminPhotoReview.tsx
git commit -m "feat(experiences): admin moderation tab for oplevelser"
git push
```

---

## Verification Checklist

After all tasks:

- [ ] `shelter_experiences` table exists in Supabase with all columns and RLS
- [ ] `experience-photos` bucket exists and is public-read
- [ ] `POST /api/experiences/upload-url` returns presigned URLs
- [ ] `POST /api/experiences` creates pending experience
- [ ] `GET /api/experiences?shelter_id=` returns approved experiences only
- [ ] `GET /api/experiences/recent` returns latest approved across all shelters
- [ ] `/api/og/oplevelse/[id]` renders PNG for pending + approved experiences
- [ ] Upload modal completes full 3-step flow and shows share card
- [ ] Shelter page shows "Oplevelser" section with upload button
- [ ] Homepage "Seneste oplevelser" section appears when experiences exist, hidden when empty
- [ ] Admin `/admin/community` "Oplevelser" tab shows pending queue with approve/reject
- [ ] Full vitest suite passes: `cd web && npm test`
