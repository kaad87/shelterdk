# Shelter Submission Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two shelter-submission flows (owner registration page + user-tip modal) that funnel into a shared `shelter_submissions` admin queue tab.

**Architecture:** New `shelter_submissions` Supabase table holds both flow types distinguished by a `type` enum column. A single `POST /api/submit-shelter` endpoint handles both. A React context provider (`ShelterTipModalProvider`) in the site layout exposes a hook so Navbar, Footer and search page can open the modal without prop-drilling. Flow 1 is a dedicated `/registrer-shelter` page; Flow 2 is the modal. Admin reviews submissions in a new "Indsendte" tab in `AdminPhotoReview`.

**Tech Stack:** Next.js 14 App Router, Supabase (service_role admin client, public client), TypeScript, Tailwind CSS, Vitest + jsdom for API tests, lucide-react icons.

---

## File Map

| File | Role |
|------|------|
| `web/migrations/20260419_shelter_submissions.sql` | DB schema — enums + table + RLS |
| `web/lib/shelter-submissions.ts` | TypeScript interfaces + facility constants |
| `web/app/api/submit-shelter/route.ts` | POST endpoint — validates + inserts |
| `web/app/api/__tests__/submit-shelter.test.ts` | Vitest tests for submit route |
| `web/app/api/admin/pending-shelter-submissions/route.ts` | GET pending list |
| `web/app/api/admin/approve-shelter-submission/route.ts` | POST approve |
| `web/app/api/admin/reject-shelter-submission/route.ts` | POST reject |
| `web/app/api/__tests__/admin-shelter-submissions.test.ts` | Vitest tests for admin routes |
| `web/components/ShelterTipModalProvider.tsx` | React context + `useShelterTipModal()` hook |
| `web/components/ShelterTipModal.tsx` | Flow 2 modal UI |
| `web/app/(site)/layout.tsx` | Wrap with `ShelterTipModalProvider` |
| `web/components/Navbar.tsx` | Add "💡 Mangler dit shelter?" button |
| `web/components/Footer.tsx` | Add tip-link to footerLinks array |
| `web/app/(site)/soeg/page.tsx` | Add missing-shelter banner above fold |
| `web/app/(site)/registrer-shelter/page.tsx` | Flow 1 — server component with metadata |
| `web/components/AdminPhotoReview.tsx` | New "Indsendte" tab |

---

## Task 1: DB Migration

**Files:**
- Create: `web/migrations/20260419_shelter_submissions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- web/migrations/20260419_shelter_submissions.sql

CREATE TYPE submission_type AS ENUM ('owner_registration', 'user_tip');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE shelter_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            submission_type NOT NULL,
  status          submission_status NOT NULL DEFAULT 'pending',

  -- Required for both flows
  shelter_name    text NOT NULL CHECK (char_length(shelter_name) > 0 AND char_length(shelter_name) <= 200),
  location_text   text NOT NULL CHECK (char_length(location_text) > 0 AND char_length(location_text) <= 200),

  -- Extended info (Flow 1)
  capacity        integer         CHECK (capacity IS NULL OR capacity > 0),
  description     text,
  facilities      jsonb,          -- keys: vand, toilet, baalplads, parkering, hund (booleans)
  booking_url     text,

  -- Contact (Flow 1)
  contact_name    text,
  contact_email   text            CHECK (type != 'owner_registration' OR contact_email IS NOT NULL),

  -- Extra info (Flow 2)
  source_info     text            CHECK (source_info IS NULL OR char_length(source_info) <= 500),

  -- Admin
  admin_note      text,
  rejected_reason text,
  reviewed_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- No public policy — only service_role can read/write
ALTER TABLE shelter_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_shelter_submissions_status ON shelter_submissions(status);
CREATE INDEX idx_shelter_submissions_created ON shelter_submissions(created_at DESC) WHERE status = 'pending';
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste migration → Run.  
Verify: Table `shelter_submissions` appears in Table Editor. Confirm both enum types exist.

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk
git add web/migrations/20260419_shelter_submissions.sql
git commit -m "feat: add shelter_submissions table migration"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `web/lib/shelter-submissions.ts`

- [ ] **Step 1: Write the types file**

```typescript
// web/lib/shelter-submissions.ts

export type SubmissionType = "owner_registration" | "user_tip";
export type SubmissionStatus = "pending" | "approved" | "rejected";

/** Canonical facility keys stored in the `facilities` JSONB column */
export const FACILITY_KEYS = ["vand", "toilet", "baalplads", "parkering", "hund"] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  vand: "💧 Vand",
  toilet: "🚽 Toilet",
  baalplads: "🔥 Bålplads",
  parkering: "🅿️ Parkering",
  hund: "🐕 Hund",
};

export interface ShelterSubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  shelter_name: string;
  location_text: string;
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
}

/** Payload shape accepted by POST /api/submit-shelter */
export interface SubmitShelterPayload {
  type: SubmissionType;
  shelter_name: string;
  location_text: string;
  capacity?: number | null;
  description?: string;
  facilities?: Partial<Record<FacilityKey, boolean>>;
  booking_url?: string;
  contact_name?: string;
  contact_email?: string;
  source_info?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/shelter-submissions.ts
git commit -m "feat: add shelter-submissions TypeScript types"
```

---

## Task 3: Submit API Route + Tests

**Files:**
- Create: `web/app/api/submit-shelter/route.ts`
- Create: `web/app/api/__tests__/submit-shelter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// web/app/api/__tests__/submit-shelter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin client
const mockInsert = vi.fn();
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

// Import after mocks
const { POST } = await import("../submit-shelter/route");

function makeRequest(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/submit-shelter", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/submit-shelter", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  it("returnerer 400 hvis type mangler", async () => {
    const res = await POST(makeRequest({ shelter_name: "Test", location_text: "Aarhus" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("type");
  });

  it("returnerer 400 hvis shelter_name mangler", async () => {
    const res = await POST(makeRequest({ type: "user_tip", location_text: "Aarhus" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returnerer 400 hvis location_text mangler", async () => {
    const res = await POST(makeRequest({ type: "user_tip", shelter_name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 ved owner_registration uden contact_email", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Test Shelter",
      location_text: "Vejle",
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("returnerer 400 ved ugyldig email-format", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Test",
      location_text: "Vejle",
      contact_email: "not-an-email",
    }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 hvis source_info er over 500 tegn", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Test",
      location_text: "Aarhus",
      source_info: "x".repeat(501),
    }));
    expect(res.status).toBe(400);
  });

  it("returnerer 201 ved gyldigt user_tip", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Shelter ved søen",
      location_text: "Silkeborg",
      source_info: "Har overnattet der to gange",
    }));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returnerer 201 ved gyldigt owner_registration", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Naturhytten",
      location_text: "Skanderborg",
      contact_email: "ejer@naturhytten.dk",
      capacity: 6,
      facilities: { vand: true, baalplads: true },
    }));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("ignorerer ukendtefields i facilities", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Test",
      location_text: "København",
    }));
    expect(res.status).toBe(201);
  });

  it("returnerer 400 ved ugyldig JSON", async () => {
    const req = new Request("http://localhost/api/submit-shelter", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.5" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/CKA/shelterdk/web
npx vitest run app/api/__tests__/submit-shelter.test.ts
```

Expected: failures like "Cannot find module ../submit-shelter/route"

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/submit-shelter/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { SubmissionType, FacilityKey, SubmitShelterPayload } from "@/lib/shelter-submissions";
import { FACILITY_KEYS } from "@/lib/shelter-submissions";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const ipTimestamps = new Map<string, number[]>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES: SubmissionType[] = ["owner_registration", "user_tip"];

export async function POST(request: Request) {
  // Rate limiting — same pattern as /api/contact/route.ts
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

  // Flow 1: email required + format check
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

  // Sanitise facilities — only allow canonical keys
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

- [ ] **Step 4: Run tests again**

```bash
npx vitest run app/api/__tests__/submit-shelter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/submit-shelter/route.ts web/app/api/__tests__/submit-shelter.test.ts
git commit -m "feat: add POST /api/submit-shelter with rate limiting and validation"
```

---

## Task 4: Admin API Routes + Tests

**Files:**
- Create: `web/app/api/admin/pending-shelter-submissions/route.ts`
- Create: `web/app/api/admin/approve-shelter-submission/route.ts`
- Create: `web/app/api/admin/reject-shelter-submission/route.ts`
- Create: `web/app/api/__tests__/admin-shelter-submissions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// web/app/api/__tests__/admin-shelter-submissions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ADMIN_SECRET = "test-admin-secret";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: mockSelect,
      update: mockUpdate,
    }),
  }),
}));

function adminRequest(method: "GET" | "POST", path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-admin-secret": "test-admin-secret",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function unauthorizedRequest(method: "GET" | "POST", path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("GET /api/admin/pending-shelter-submissions", () => {
  const { GET } = await import("../admin/pending-shelter-submissions/route");

  beforeEach(() => {
    mockSelect.mockReset();
    mockSelect.mockReturnValue({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await GET(unauthorizedRequest("GET", "/api/admin/pending-shelter-submissions") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer submissions array ved succes", async () => {
    const fakeRow = { id: "abc", type: "user_tip", shelter_name: "Test", status: "pending", created_at: new Date().toISOString() };
    mockSelect.mockReturnValue({
      eq: () => ({ order: () => Promise.resolve({ data: [fakeRow], error: null }) }),
    });
    const res = await GET(adminRequest("GET", "/api/admin/pending-shelter-submissions") as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submissions).toHaveLength(1);
  });
});

describe("POST /api/admin/approve-shelter-submission", () => {
  const { POST } = await import("../admin/approve-shelter-submission/route");

  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await POST(unauthorizedRequest("POST", "/api/admin/approve-shelter-submission") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer 400 uden submissionId", async () => {
    const res = await POST(adminRequest("POST", "/api/admin/approve-shelter-submission", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 200 ved godkendelse", async () => {
    const res = await POST(adminRequest("POST", "/api/admin/approve-shelter-submission", { submissionId: "abc-123" }) as never);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/reject-shelter-submission", () => {
  const { POST } = await import("../admin/reject-shelter-submission/route");

  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await POST(unauthorizedRequest("POST", "/api/admin/reject-shelter-submission") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer 400 uden submissionId", async () => {
    const res = await POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 200 ved afvisning", async () => {
    const res = await POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {
      submissionId: "abc-123",
      reason: "Duplikat"
    }) as never);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx vitest run app/api/__tests__/admin-shelter-submissions.test.ts
```

- [ ] **Step 3: Write the three admin routes**

**`pending-shelter-submissions/route.ts`:**
```typescript
// web/app/api/admin/pending-shelter-submissions/route.ts
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
    .from("shelter_submissions")
    .select(
      "id, type, status, shelter_name, location_text, capacity, description, facilities, booking_url, contact_name, contact_email, source_info, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message).includes("shelter_submissions")) {
      return Response.json({ submissions: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ submissions: data ?? [] });
}
```

**`approve-shelter-submission/route.ts`:**
```typescript
// web/app/api/admin/approve-shelter-submission/route.ts
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

  let body: { submissionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    return Response.json({ error: "Mangler submissionId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shelter_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("status", "pending"); // idempotency guard

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

**`reject-shelter-submission/route.ts`:**
```typescript
// web/app/api/admin/reject-shelter-submission/route.ts
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

  let body: { submissionId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    return Response.json({ error: "Mangler submissionId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shelter_submissions")
    .update({
      status: "rejected",
      rejected_reason: body.reason?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending"); // idempotency guard

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run app/api/__tests__/admin-shelter-submissions.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  web/app/api/admin/pending-shelter-submissions/route.ts \
  web/app/api/admin/approve-shelter-submission/route.ts \
  web/app/api/admin/reject-shelter-submission/route.ts \
  web/app/api/__tests__/admin-shelter-submissions.test.ts
git commit -m "feat: add admin API routes for shelter submissions"
```

---

## Task 5: Modal Provider (Context)

**Files:**
- Create: `web/components/ShelterTipModalProvider.tsx`
- Modify: `web/app/(site)/layout.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// web/components/ShelterTipModalProvider.tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ShelterTipModalContextValue {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ShelterTipModalContext = createContext<ShelterTipModalContextValue | null>(null);

export function ShelterTipModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <ShelterTipModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </ShelterTipModalContext.Provider>
  );
}

export function useShelterTipModal(): ShelterTipModalContextValue {
  const ctx = useContext(ShelterTipModalContext);
  if (!ctx) throw new Error("useShelterTipModal must be used inside ShelterTipModalProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap site layout**

Read `web/app/(site)/layout.tsx` first, then edit it to add the provider. The layout currently looks like:

```tsx
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CookieBanner />
      <Suspense fallback={<header className="h-16 border-b border-primary/10" />}>
        <Navbar />
      </Suspense>
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
```

Add the import and wrap the JSX:

```tsx
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { ShelterTipModalProvider } from "@/components/ShelterTipModalProvider";
import { ShelterTipModal } from "@/components/ShelterTipModal";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShelterTipModalProvider>
      <CookieBanner />
      <Suspense fallback={<header className="h-16 border-b border-primary/10" />}>
        <Navbar />
      </Suspense>
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <ShelterTipModal />
    </ShelterTipModalProvider>
  );
}
```

Note: `ShelterTipModal` is added here (no props) — it reads `isOpen`/`closeModal` from context internally.

- [ ] **Step 3: Commit**

```bash
git add web/components/ShelterTipModalProvider.tsx web/app/(site)/layout.tsx
git commit -m "feat: add ShelterTipModalProvider context for site-wide modal access"
```

---

## Task 6: ShelterTipModal Component (Flow 2)

**Files:**
- Create: `web/components/ShelterTipModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// web/components/ShelterTipModal.tsx
"use client";

import { useState } from "react";
import { X, Lightbulb, Loader2, CheckCircle } from "lucide-react";
import { useShelterTipModal } from "@/components/ShelterTipModalProvider";

type State = "idle" | "loading" | "success" | "error";

export function ShelterTipModal() {
  const { isOpen, closeModal } = useShelterTipModal();
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    closeModal();
    // Reset after animation (instant here)
    setShelterName("");
    setLocationText("");
    setSourceInfo("");
    setState("idle");
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelterName.trim() || !locationText.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_tip",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          source_info: sourceInfo.trim() || undefined,
        }),
      });
      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Noget gik galt. Prøv igen.");
        setState("error");
      }
    } catch {
      setErrorMsg("Netværksfejl. Tjek din forbindelse og prøv igen.");
      setState("error");
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tip om manglende shelter"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#4a90d9] text-white px-5 py-4 rounded-t-2xl">
          <Lightbulb size={20} />
          <span className="font-semibold">Tip om manglende shelter</span>
          <button
            onClick={handleClose}
            className="ml-auto rounded-full hover:bg-white/20 p-1 transition-colors"
            aria-label="Luk"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={48} className="text-green-500" />
              <p className="font-semibold text-primary text-lg">Tak — vi kigger på det!</p>
              <p className="text-sm text-primary/60">Dit tip er registreret og behandles inden for få dage.</p>
              <button
                onClick={handleClose}
                className="mt-2 bg-[#4a90d9] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#3a7bc8] transition-colors"
              >
                Luk
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-primary/70 bg-blue-50 rounded-lg px-3 py-2.5">
                Kender du et shelter der ikke findes på ShelterDK? Fortæl os om det — vi kigger på det.
              </p>

              {/* Shelter name */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Shelterens navn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={shelterName}
                  onChange={(e) => setShelterName(e.target.value)}
                  placeholder='Fx "Shelter ved Silkeborg Sø"'
                  required
                  maxLength={200}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/40"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Placering <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Adresse, by eller postnr"
                  required
                  maxLength={200}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/40"
                />
              </div>

              {/* Extra info */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Hvad ved du om shelteren?{" "}
                  <span className="font-normal text-primary/50">(valgfrit)</span>
                </label>
                <textarea
                  value={sourceInfo}
                  onChange={(e) => setSourceInfo(e.target.value)}
                  placeholder="Fx hvem der ejer den, link til kommunens hjemmeside..."
                  maxLength={500}
                  rows={3}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/40 resize-none"
                />
                <div className="text-right text-xs text-primary/40 mt-0.5">
                  {sourceInfo.length}/500
                </div>
              </div>

              {errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-1">
                <button
                  type="submit"
                  disabled={state === "loading" || !shelterName.trim() || !locationText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4a90d9] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[#3a7bc8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state === "loading" ? (
                    <><Loader2 size={15} className="animate-spin" /> Sender...</>
                  ) : (
                    "Send tip"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="border border-primary/20 text-primary/70 font-medium px-4 py-2.5 rounded-xl hover:bg-primary/5 transition-colors"
                >
                  Annuller
                </button>
              </div>

              <p className="text-center text-xs text-primary/40">
                Ingen konto krævet · behandles inden for få dage
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/CKA/shelterdk/web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/ShelterTipModal.tsx
git commit -m "feat: add ShelterTipModal component (Flow 2)"
```

---

## Task 7: Site Integrations — Navbar, Footer, Søgeside

**Files:**
- Modify: `web/components/Navbar.tsx`
- Modify: `web/components/Footer.tsx`
- Modify: `web/app/(site)/soeg/page.tsx`

### 7a: Navbar

- [ ] **Step 1: Read `web/components/Navbar.tsx` to find the right insertion point**

The Navbar component is a client component (`"use client"`). Find where the desktop nav buttons are rendered — near the `navEntries.map(...)` section around line 140–170.

- [ ] **Step 2: Add import + button**

At the top of `Navbar.tsx`, add to existing imports:
```tsx
import { useShelterTipModal } from "@/components/ShelterTipModalProvider";
```

Inside the `Navbar` function, add:
```tsx
const { openModal } = useShelterTipModal();
```

In the desktop nav area (after the navEntries map, before the search button), add:
```tsx
<button
  onClick={openModal}
  className="hidden lg:flex items-center gap-1.5 bg-[#4a90d9] text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#3a7bc8] transition-colors"
>
  <span>💡</span>
  Mangler dit shelter?
</button>
```

In the mobile menu (inside the mobile nav list), add a link item that also calls `openModal`:
```tsx
<li>
  <button
    onClick={() => { openModal(); setMenuOpen(false); }}
    className="w-full text-left block px-4 py-3 text-sm text-primary/80 hover:text-accent hover:bg-primary/5 transition-colors"
  >
    💡 Mangler dit shelter?
  </button>
</li>
```

### 7b: Footer

- [ ] **Step 3: Add link to footerLinks in `Footer.tsx`**

Footer is a server component — it cannot use context. Add it as a static link to `/registrer-shelter` instead (which is the owner registration page, but also appropriate for users who want to report missing shelters):

In `Footer.tsx`, find the `footerLinks` array and add:
```tsx
{ label: "Tilføj manglende shelter", href: "/registrer-shelter" },
```

Add it near the top of the list, after "Søg shelters".

### 7c: Søgeside-banner

- [ ] **Step 4: Add banner to søgeside**

The søgeside renders `<SoegContent>` which is a client component. We need a client-side banner inside `SoegContent` or inline in `soeg/page.tsx`. Since page.tsx is a server component, create a small client component in `web/components/MissingShelterBanner.tsx`:

```tsx
// web/components/MissingShelterBanner.tsx
"use client";

import { useShelterTipModal } from "@/components/ShelterTipModalProvider";

export function MissingShelterBanner() {
  const { openModal } = useShelterTipModal();
  return (
    <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mt-4 mb-2">
      <p className="text-sm text-primary/70">
        <span className="font-medium text-primary">Mangler dit shelter?</span>{" "}
        Kender du et shelter der ikke er på ShelterDK?
      </p>
      <button
        onClick={openModal}
        className="flex-none text-sm font-semibold text-[#4a90d9] hover:text-[#3a7bc8] whitespace-nowrap"
      >
        Fortæl os om det →
      </button>
    </div>
  );
}
```

Then in `web/app/(site)/soeg/page.tsx`, find where `<SoegContent>` is rendered and add the banner before it. Since soeg/page is a server component, import `MissingShelterBanner` with dynamic import:

```tsx
import dynamic from "next/dynamic";
const MissingShelterBanner = dynamic(
  () => import("@/components/MissingShelterBanner").then((m) => m.MissingShelterBanner),
  { ssr: false }
);
```

Then in the JSX, add `<MissingShelterBanner />` just before `<SoegContent .../>`.

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add \
  web/components/Navbar.tsx \
  web/components/Footer.tsx \
  web/components/MissingShelterBanner.tsx \
  web/app/(site)/soeg/page.tsx
git commit -m "feat: add shelter-tip modal triggers to navbar, footer and søgeside"
```

---

## Task 8: Registrer-shelter Page (Flow 1)

**Files:**
- Create: `web/app/(site)/registrer-shelter/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
// web/app/(site)/registrer-shelter/page.tsx
import type { Metadata } from "next";
import { RegistrerShelterForm } from "./RegistrerShelterForm";

export const metadata: Metadata = {
  title: "Registrér dit shelter på ShelterDK",
  description:
    "Er du ejer eller operatør af et shelter? Tilmeld det gratis og nå tusindvis af friluftsentusiaster på Danmarks største shelterguide.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://shelterdk.dk/registrer-shelter" },
};

export default function RegistrerShelterPage() {
  return (
    <div className="min-h-screen bg-[#f9f7f4]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a26] to-[#2d7a4e] text-white py-14 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">
            Få dit shelter på Danmarks største shelterguide
          </h1>
          <p className="text-white/80 text-lg">
            Gratis · du godkender inden publicering · når tusindvis af friluftsentusiaster
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🆓</span>
              <span><strong>Helt gratis</strong><br /><span className="text-white/70">Altid</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span><strong>Du godkender</strong><br /><span className="text-white/70">Inden publicering</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span><strong>Opdatér når du vil</strong><br /><span className="text-white/70">Kontakt os ved ændringer</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <RegistrerShelterForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the form sub-component**

Create `web/app/(site)/registrer-shelter/RegistrerShelterForm.tsx`:

```tsx
// web/app/(site)/registrer-shelter/RegistrerShelterForm.tsx
"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { FACILITY_KEYS, FACILITY_LABELS, type FacilityKey } from "@/lib/shelter-submissions";

type FormState = "idle" | "loading" | "success" | "error";

export function RegistrerShelterForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  // Form fields
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [facilities, setFacilities] = useState<Partial<Record<FacilityKey, boolean>>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  const toggleFacility = (key: FacilityKey) => {
    setFacilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    setSubmittedEmail(contactEmail.trim());

    try {
      const cap = capacity ? parseInt(capacity, 10) : undefined;
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "owner_registration",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          capacity: cap && cap > 0 ? cap : null,
          description: description.trim() || undefined,
          facilities: Object.keys(facilities).length > 0 ? facilities : undefined,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim(),
          booking_url: bookingUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Noget gik galt. Prøv igen.");
        setState("error");
      }
    } catch {
      setErrorMsg("Netværksfejl. Tjek din forbindelse og prøv igen.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d0] p-10 text-center">
        <CheckCircle size={56} className="text-[#2d7a4e] mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-primary mb-2">
          Tak for din tilmelding!
        </h2>
        <p className="text-primary/70">
          Vi kontakter dig på <strong>{submittedEmail}</strong> inden shelteren publiceres, så du kan godkende indholdet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-[#e8e0d0] overflow-hidden"
    >
      {/* Section: Om shelteren */}
      <div className="px-6 py-5 border-b border-[#eee]">
        <h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">
          Om shelteren
        </h2>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Navn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shelterName}
              onChange={(e) => setShelterName(e.target.value)}
              placeholder="Shelterens fulde navn"
              required
              maxLength={200}
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
            />
          </div>

          {/* Address + Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Adresse <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Vejnavn og by"
                required
                maxLength={200}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Kapacitet
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Antal pladser"
                min={1}
                max={999}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Beskrivelse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort om stedet..."
              rows={3}
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40 resize-none"
            />
          </div>

          {/* Facilities */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">
              Faciliteter
            </label>
            <div className="flex flex-wrap gap-2">
              {FACILITY_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFacility(key)}
                  className={`text-sm px-3.5 py-1.5 rounded-full border-2 transition-all ${
                    facilities[key]
                      ? "border-[#2d7a4e] bg-[#f0faf4] text-[#2d7a4e] font-semibold"
                      : "border-primary/20 text-primary/70 hover:border-primary/40"
                  }`}
                >
                  {FACILITY_LABELS[key]}
                  {facilities[key] && " ✓"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Kontakt */}
      <div className="px-6 py-5">
        <h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">
          Dine kontaktoplysninger
        </h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Dit navn
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Navn"
                maxLength={100}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="til bekræftelse"
                required
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Bookinglink
            </label>
            <input
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-[#2d7a4e] text-white font-semibold py-3 rounded-xl hover:bg-[#236040] disabled:opacity-50 transition-colors"
        >
          {state === "loading" ? (
            <><Loader2 size={16} className="animate-spin" /> Sender...</>
          ) : (
            "Indsend til gennemgang"
          )}
        </button>
        <p className="mt-2 text-center text-xs text-primary/40">
          Vi kontakter dig på email inden shelteren publiceres
        </p>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add web/app/(site)/registrer-shelter/
git commit -m "feat: add /registrer-shelter landing page (Flow 1)"
```

---

## Task 9: Admin Tab — "Indsendte"

**Files:**
- Modify: `web/components/AdminPhotoReview.tsx`

- [ ] **Step 1: Read the current AdminPhotoReview.tsx**

Read the file to understand the exact current state. Key things to add:
1. `TabKey` type: add `"submissions"` to the union
2. New `ShelterSubmission` type (import from `@/lib/shelter-submissions`)
3. `TAB_CONFIG`: add `{ key: "submissions", label: "Indsendte", icon: Plus }`
4. State: `const [shelterSubmissions, setShelterSubmissions] = useState<ShelterSubmission[]>([])`
5. `badgeCounts`: add `submissions: shelterSubmissions.length`
6. `fetchAll`: add fetch for `/api/admin/pending-shelter-submissions`
7. 401-reset block: add `setShelterSubmissions([])`
8. New tab panel for "submissions"

- [ ] **Step 2: Make the changes**

**In the imports**, add:
```tsx
import type { ShelterSubmission } from "@/lib/shelter-submissions";
import { FACILITY_LABELS } from "@/lib/shelter-submissions";
```

**Change `TabKey` type:**
```tsx
type TabKey = "photos" | "community" | "instagram" | "newsletter" | "contact" | "oplevelser" | "submissions";
```

**Add to `TAB_CONFIG`:**
```tsx
{ key: "submissions", label: "Indsendte", icon: Plus },
```

**Add state** (after `const [experiences, setExperiences]...`):
```tsx
const [shelterSubmissions, setShelterSubmissions] = useState<ShelterSubmission[]>([]);
```

**Update `badgeCounts`** to include:
```tsx
submissions: shelterSubmissions.length,
```

**In `fetchAll`, extend the `Promise.all`** to include a 7th fetch:
```tsx
fetch(`/api/admin/pending-shelter-submissions?t=${ts}`, {
  headers: { "x-admin-secret": s },
  cache: "no-store",
}),
```

And destructure it:
```tsx
const [photoRes, communityRes, igRes, nlRes, contactRes, experiencesRes, submissionsRes] = await Promise.all([...]);
```

Add handling at the bottom of the try block:
```tsx
if (submissionsRes.ok) {
  const subsData = await submissionsRes.json();
  setShelterSubmissions(subsData.submissions ?? []);
}
```

**In 401-reset block**, add:
```tsx
setShelterSubmissions([]);
```

**Add the "submissions" tab panel** (in the JSX, after the "oplevelser" panel):

```tsx
{tab === "submissions" && (
  <div className="flex flex-col gap-4">
    {shelterSubmissions.length === 0 ? (
      <p className="text-sm text-primary/50 text-center py-10">
        Ingen indsendte shelters til behandling
      </p>
    ) : (
      shelterSubmissions.map((sub) => (
        <div key={sub.id} className="border border-primary/10 rounded-xl p-4 bg-white">
          {/* Type badge */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  sub.type === "owner_registration"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {sub.type === "owner_registration" ? "🏠 Ejer" : "💡 Bruger-tip"}
              </span>
              <span className="text-xs text-primary/40">
                {new Date(sub.created_at).toLocaleDateString("da-DK")}
              </span>
            </div>
          </div>

          {/* Core info */}
          <div className="space-y-1 mb-3">
            <p className="font-semibold text-primary">{sub.shelter_name}</p>
            <p className="text-sm text-primary/70">📍 {sub.location_text}</p>
            {sub.capacity && (
              <p className="text-sm text-primary/60">👥 {sub.capacity} pladser</p>
            )}
          </div>

          {/* Facilities */}
          {sub.facilities && Object.keys(sub.facilities).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(Object.entries(sub.facilities) as [string, boolean][])
                .filter(([, v]) => v)
                .map(([k]) => (
                  <span
                    key={k}
                    className="text-xs bg-primary/5 text-primary/70 px-2 py-0.5 rounded-full"
                  >
                    {FACILITY_LABELS[k as keyof typeof FACILITY_LABELS] ?? k}
                  </span>
                ))}
            </div>
          )}

          {/* Description */}
          {sub.description && (
            <p className="text-sm text-primary/60 italic mb-3 line-clamp-2">{sub.description}</p>
          )}

          {/* Source info (user tip) */}
          {sub.source_info && (
            <p className="text-sm text-primary/60 mb-3">
              <span className="font-medium">Tip:</span> {sub.source_info}
            </p>
          )}

          {/* Contact info (owner) */}
          {sub.type === "owner_registration" && (
            <div className="bg-green-50 rounded-lg px-3 py-2 mb-3 text-sm">
              {sub.contact_name && <p className="font-medium text-primary">{sub.contact_name}</p>}
              {sub.contact_email && (
                <a
                  href={`mailto:${sub.contact_email}`}
                  className="text-[#2d7a4e] hover:underline"
                >
                  {sub.contact_email}
                </a>
              )}
              {sub.booking_url && (
                <a
                  href={sub.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[#2d7a4e] hover:underline truncate"
                >
                  {sub.booking_url}
                </a>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              disabled={actingId === sub.id}
              onClick={async () => {
                setActingId(sub.id);
                await fetch("/api/admin/approve-shelter-submission", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-admin-secret": secret,
                  },
                  body: JSON.stringify({ submissionId: sub.id }),
                });
                await fetchAll(secret);
                setActingId(null);
              }}
              className="flex items-center gap-1.5 bg-[#2d7a4e] text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#236040] disabled:opacity-50 transition-colors"
            >
              <Check size={14} /> Godkend
            </button>
            <button
              disabled={actingId === sub.id}
              onClick={async () => {
                const reason = prompt("Årsag til afvisning (valgfrit):") ?? "";
                setActingId(sub.id);
                await fetch("/api/admin/reject-shelter-submission", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-admin-secret": secret,
                  },
                  body: JSON.stringify({ submissionId: sub.id, reason }),
                });
                await fetchAll(secret);
                setActingId(null);
              }}
              className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <X size={14} /> Afvis
            </button>
          </div>
        </div>
      ))
    )}
  </div>
)}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If TypeScript complains about `Record<TabKey, number>` for `badgeCounts`, verify that `submissions` is added there.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add web/components/AdminPhotoReview.tsx
git commit -m "feat: add Indsendte tab to AdminPhotoReview for shelter submissions"
```

---

## Final Verification

- [ ] **Deploy to Netlify / run local dev server**

```bash
cd /Users/CKA/shelterdk/web
npm run dev
```

- [ ] **Check 1: `/registrer-shelter` loads with hero + form**

Visit `http://localhost:3000/registrer-shelter`. Confirm:
- Green gradient hero visible
- All form fields present
- Submit with only name + email → 201 response → success message shown

- [ ] **Check 2: Header modal trigger**

Click "💡 Mangler dit shelter?" button in desktop navbar. Modal opens. Fill name + placering + submit. Success state shown. Row appears in Supabase `shelter_submissions` table.

- [ ] **Check 3: Footer link**

`/registrer-shelter` link visible in footer "Sider" column.

- [ ] **Check 4: Søgeside banner**

Visit `http://localhost:3000/soeg`. Blue banner visible above or near results. Click "Fortæl os om det →" — modal opens.

- [ ] **Check 5: Admin panel**

Visit `/admin`. Log in. "Indsendte" tab shows badge with pending count. Submissions visible with correct type badges (grønt = ejer, blåt = tip). Approve/reject buttons work.

- [ ] **Check 6: TypeScript + tests clean**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass.

- [ ] **Final commit tag**

```bash
git tag v-shelter-submission-flow
```
