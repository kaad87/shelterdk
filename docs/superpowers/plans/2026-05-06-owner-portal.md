# Owner Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give shelter owners a login-based portal to manage their shelters — edit content, pricing, and photos — with email+password auth via Supabase Auth.

**Architecture:** Supabase Auth (email+password) with `@supabase/ssr` cookie-based sessions. No RLS — API routes explicitly verify ownership by matching `auth_user_id` on `bookable_shelters`. Token-based `/owner/[token]` access unchanged as read-only backup. New pages at `/ejer/*` outside the `(site)` route group (no Navbar/Footer).

**Tech Stack:** Next.js 14 App Router, `@supabase/ssr` v0.5, Supabase Auth, Supabase Storage (`shelter-photos` bucket), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `migrations/040_owner_auth.sql` | Create | Add `auth_user_id` column to `bookable_shelters` |
| `web/types/booking.ts` | Modify | Add `auth_user_id?: string \| null` to `BookableShelter` |
| `web/utils/supabase/server-session.ts` | Create | Supabase SSR client (reads/writes session cookies) |
| `web/middleware.ts` | Create | Protect `/ejer/*`, redirect unauthenticated to `/ejer/login` |
| `web/lib/owner-db.ts` | Create | All DB functions for owner portal (lookup, update, photos) |
| `web/app/ejer/layout.tsx` | Create | Minimal portal layout with logo + logout link |
| `web/app/ejer/login/page.tsx` | Create | Login page (Server Component wrapping LoginForm) |
| `web/app/ejer/signup/page.tsx` | Create | Signup page (Server Component wrapping SignupForm) |
| `web/app/ejer/dashboard/page.tsx` | Create | Dashboard (Server Component — fetches shelters) |
| `web/app/ejer/shelter/[id]/rediger/page.tsx` | Create | Edit page (Server Component — fetches shelter + photos) |
| `web/components/ejer/LoginForm.tsx` | Create | Client form: email+password login |
| `web/components/ejer/SignupForm.tsx` | Create | Client form: email+password signup |
| `web/components/ejer/ShelterEditForm.tsx` | Create | Client form: edit shelter fields + image gallery + upload |
| `web/app/api/ejer/login/route.ts` | Create | POST — signInWithPassword |
| `web/app/api/ejer/signup/route.ts` | Create | POST — signUp + link auth_user_id to shelters |
| `web/app/api/ejer/logout/route.ts` | Create | POST — signOut |
| `web/app/api/ejer/shelters/route.ts` | Create | GET — list user's shelters with booking counts |
| `web/app/api/ejer/shelter/[id]/route.ts` | Create | PATCH — update title/description/max_persons/price |
| `web/app/api/ejer/shelter/[id]/billeder/route.ts` | Create | POST upload + DELETE remove photo |
| `web/app/api/__tests__/ejer.test.ts` | Create | Tests for all ejer API routes |

---

## Task 1: DB Migration + Type Update

**Files:**
- Create: `migrations/040_owner_auth.sql`
- Modify: `web/types/booking.ts` line 1–19 (the `BookableShelter` interface)

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/040_owner_auth.sql
-- Adds auth_user_id to bookable_shelters so owners can log in with Supabase Auth.
-- Nullable — existing shelters start with NULL and get linked when the owner signs up.

ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN bookable_shelters.auth_user_id IS
  'Links this shelter to a Supabase Auth user. Set when the owner signs up with the same email as owner_email.';

CREATE INDEX IF NOT EXISTS bookable_shelters_auth_user_id_idx
  ON bookable_shelters (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
```

- [ ] **Step 2: Run the migration in Supabase dashboard**

Open the Supabase SQL editor for the shelterdk project and run the contents of `migrations/040_owner_auth.sql`. Verify with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookable_shelters' AND column_name = 'auth_user_id';
```
Expected: one row, `data_type = uuid`, `is_nullable = YES`.

- [ ] **Step 3: Update `BookableShelter` type**

In `web/types/booking.ts`, add `auth_user_id` to the `BookableShelter` interface after `owner_token`:

```typescript
export interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shelter_id: string | null;
  owner_email: string;
  owner_token: string;
  auth_user_id: string | null;          // ← add this line
  max_persons: number;
  // ... rest unchanged
```

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk
git add migrations/040_owner_auth.sql web/types/booking.ts
git commit -m "feat: add auth_user_id to bookable_shelters for owner portal"
```

---

## Task 2: Supabase SSR Session Client

**Files:**
- Create: `web/utils/supabase/server-session.ts`

This client reads and writes session cookies. Used by all `/api/ejer/*` routes and by server components under `/ejer/`. Follow the same pattern as `server-admin.ts` and `server-public.ts` — a factory function, no module-level singleton.

- [ ] **Step 1: Create `web/utils/supabase/server-session.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client that reads and writes session cookies.
 * Use in API routes and Server Components under /ejer/*.
 * Uses the anon key — permissions come from Supabase Auth session, not service_role.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Thrown in read-only Server Component render contexts.
            // Safe to ignore — the middleware refreshes the session cookie.
          }
        },
      },
    }
  );
}

/**
 * Get the currently authenticated user from session cookies.
 * Returns null if not logged in.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk
git add web/utils/supabase/server-session.ts
git commit -m "feat: add Supabase SSR session client for owner portal"
```

---

## Task 3: Middleware

**Files:**
- Create: `web/middleware.ts`

Protects all `/ejer/*` paths except `/ejer/login` and `/ejer/signup`. Unauthenticated requests are redirected to `/ejer/login?next=[path]`.

**Important:** The middleware must also refresh the session (re-set cookies) on every request to keep it alive. This is the standard Supabase SSR middleware pattern.

- [ ] **Step 1: Create `web/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Create a Supabase client that can refresh session cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — this keeps the session alive and rotates tokens
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicEjerRoute =
    pathname === "/ejer/login" ||
    pathname === "/ejer/signup" ||
    pathname.startsWith("/ejer/login") ||
    pathname.startsWith("/ejer/signup");

  if (pathname.startsWith("/ejer") && !isPublicEjerRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ejer/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/ejer/:path*"],
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/CKA/shelterdk/web && npm run build 2>&1 | head -30
```
Expected: no TypeScript errors on middleware.ts.

- [ ] **Step 3: Commit**

```bash
git add web/middleware.ts
git commit -m "feat: add middleware to protect /ejer/* routes"
```

---

## Task 4: `lib/owner-db.ts`

**Files:**
- Create: `web/lib/owner-db.ts`

All DB operations for the owner portal. Uses `createAdminClient` (service_role) for writes — ownership is enforced at the API layer, not RLS. Pure functions — easy to mock in tests.

- [ ] **Step 1: Create `web/lib/owner-db.ts`**

```typescript
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookableShelter } from "@/types/booking";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const BUCKET = "shelter-photos";

// ─── Shelter lookup ──────────────────────────────────────────────────────────

/**
 * Returns all bookable_shelters owned by the given auth user, plus
 * active booking count for each (confirmed bookings with check_out >= today).
 */
export async function getSheltersByAuthUser(
  authUserId: string
): Promise<Array<BookableShelter & { active_booking_count: number }>> {
  const supabase = createAdminClient();

  const { data: shelters } = await supabase
    .from("bookable_shelters")
    .select("*")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: true });

  if (!shelters?.length) return [];

  const today = new Date().toISOString().slice(0, 10);

  const counts = await Promise.all(
    shelters.map(async (s) => {
      const { count } = await supabase
        .from("shelter_bookings")
        .select("id", { count: "exact", head: true })
        .eq("bookable_shelter_id", s.id)
        .eq("status", "confirmed")
        .gte("check_out", today);
      return { id: s.id, count: count ?? 0 };
    })
  );

  return shelters.map((s) => ({
    ...s,
    active_booking_count: counts.find((c) => c.id === s.id)?.count ?? 0,
  }));
}

/**
 * Returns a single bookable_shelter if it belongs to the given auth user.
 * Returns null if not found OR if the shelter belongs to a different user.
 */
export async function getOwnerShelterById(
  shelterId: string,
  authUserId: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", shelterId)
    .eq("auth_user_id", authUserId)
    .single();
  return data ?? null;
}

// ─── Shelter update ──────────────────────────────────────────────────────────

export interface OwnerShelterUpdate {
  title?: string;
  description?: string;
  max_persons?: number;
  shelter_price_dkk?: number | null;
}

/**
 * Updates allowed owner-editable fields on bookable_shelters.
 * shelterId + authUserId must match (ownership is verified by the API layer
 * before calling this, so no second ownership check here).
 */
export async function updateOwnerShelter(
  shelterId: string,
  fields: OwnerShelterUpdate
): Promise<BookableShelter | null> {
  // Note: bookable_shelters has no updated_at column — do not include it
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .update({ ...fields })
    .eq("id", shelterId)
    .select("*")
    .single();
  return data ?? null;
}

// ─── Photo helpers ───────────────────────────────────────────────────────────

/**
 * Returns the user_image_urls array for the main shelter record.
 * shelterDbId is bookable_shelters.shelter_id (the shelters.id FK).
 */
export async function getShelterPhotos(shelterDbId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("shelters")
    .select("user_image_urls")
    .eq("id", shelterDbId)
    .single();
  const urls = data?.user_image_urls;
  return Array.isArray(urls) ? (urls as string[]) : [];
}

/**
 * Appends a public image URL to shelters.user_image_urls[].
 */
export async function appendShelterPhoto(
  shelterDbId: string,
  url: string
): Promise<void> {
  const existing = await getShelterPhotos(shelterDbId);
  await createAdminClient()
    .from("shelters")
    .update({ user_image_urls: [...existing, url] })
    .eq("id", shelterDbId);
}

/**
 * Removes a public image URL from shelters.user_image_urls[] by exact match.
 */
export async function removeShelterPhoto(
  shelterDbId: string,
  url: string
): Promise<void> {
  const existing = await getShelterPhotos(shelterDbId);
  await createAdminClient()
    .from("shelters")
    .update({ user_image_urls: existing.filter((u) => u !== url) })
    .eq("id", shelterDbId);
}

/**
 * Returns the public URL for a file stored in the shelter-photos bucket.
 */
export function shelterPhotoUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

/**
 * Extracts the storage path from a public shelter-photos URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
export function extractPhotoPath(url: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

/**
 * Validates that a storage path belongs to the given shelter.
 * Prevents owners from deleting other shelters' photos.
 */
export function isOwnerPhotoPath(path: string, shelterDbId: string): boolean {
  return path.startsWith(`owner/${shelterDbId}/`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | grep owner-db
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/owner-db.ts
git commit -m "feat: add owner-db helpers for owner portal"
```

---

## Task 5: Auth API Routes (login, signup, logout)

**Files:**
- Create: `web/app/api/ejer/login/route.ts`
- Create: `web/app/api/ejer/signup/route.ts`
- Create: `web/app/api/ejer/logout/route.ts`
- Create (tests): `web/app/api/__tests__/ejer.test.ts`

**Pre-requisite:** Disable email confirmation in Supabase dashboard: Authentication → Email → toggle off "Confirm email". Do this before testing signup.

- [ ] **Step 1: Write failing tests for auth routes**

Create `web/app/api/__tests__/ejer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock Supabase SSR session client ─────────────────────────────────────────
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/utils/supabase/server-session", () => ({
  createSessionClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      getUser: mockGetUser,
    },
  }),
  getSessionUser: vi.fn(),
}));

// ─── Mock admin client for signup shelter-linking ─────────────────────────────
const mockFrom = vi.fn();
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Login route ──────────────────────────────────────────────────────────────
describe("POST /api/ejer/login", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 on valid credentials", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "kim@test.dk" }, session: {} },
      error: null,
    });
    const { POST } = await import("../ejer/login/route");
    const req = new NextRequest("http://localhost/api/ejer/login", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 401 on invalid credentials", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });
    const { POST } = await import("../ejer/login/route");
    const req = new NextRequest("http://localhost/api/ejer/login", {
      method: "POST",
      body: JSON.stringify({ email: "bad@test.dk", password: "wrong" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Forkert email eller adgangskode");
  });

  it("returns 400 when email or password is missing", async () => {
    const { POST } = await import("../ejer/login/route");
    const req = new NextRequest("http://localhost/api/ejer/login", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Signup route ─────────────────────────────────────────────────────────────
describe("POST /api/ejer/signup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 and links shelters on valid signup", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "new-user-1", email: "kim@test.dk" }, session: {} },
      error: null,
    });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: "shelter-1" }], error: null }),
          }),
        }),
      }),
    });

    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 409 if email already registered", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "existing@test.dk", password: "secret123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is too short", async () => {
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "abc" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail (route files don't exist yet)**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -20
```
Expected: FAIL — import errors on missing route files.

- [ ] **Step 3: Create `web/app/api/ejer/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email og adgangskode er påkrævet" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Forkert email eller adgangskode" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `web/app/api/ejer/signup/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email og adgangskode er påkrævet" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn` },
      { status: 400 }
    );
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const isExisting = error.message.toLowerCase().includes("already registered")
      || error.message.toLowerCase().includes("already exists");
    if (isExisting) {
      return NextResponse.json(
        { error: "Der findes allerede en konto med denne email — log ind i stedet" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    // Should not happen when email confirmation is disabled
    return NextResponse.json(
      { error: "Konto oprettet — tjek din email for at bekræfte" },
      { status: 202 }
    );
  }

  // Link shelters with matching owner_email to this new auth user
  const { data: linked } = await createAdminClient()
    .from("bookable_shelters")
    .update({ auth_user_id: data.user.id })
    .eq("owner_email", email)
    .is("auth_user_id", null)
    .select("id");

  const sheltersLinked = linked?.length ?? 0;

  return NextResponse.json({ ok: true, sheltersLinked });
}
```

- [ ] **Step 5: Create `web/app/api/ejer/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run tests — expect them to pass**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/api/ejer/login/route.ts web/app/api/ejer/signup/route.ts web/app/api/ejer/logout/route.ts web/app/api/__tests__/ejer.test.ts
git commit -m "feat: auth API routes for owner portal (login, signup, logout)"
```

---

## Task 6: Shelter Data API Routes

**Files:**
- Create: `web/app/api/ejer/shelters/route.ts`
- Create: `web/app/api/ejer/shelter/[id]/route.ts`
- Modify: `web/app/api/__tests__/ejer.test.ts` (add tests)

- [ ] **Step 1: Add tests for shelter data routes to `ejer.test.ts`**

Append to `web/app/api/__tests__/ejer.test.ts`:

```typescript
// ─── Mock owner-db ────────────────────────────────────────────────────────────
const mockGetSheltersByAuthUser = vi.fn();
const mockGetOwnerShelterById = vi.fn();
const mockUpdateOwnerShelter = vi.fn();

vi.mock("@/lib/owner-db", () => ({
  getSheltersByAuthUser: mockGetSheltersByAuthUser,
  getOwnerShelterById: mockGetOwnerShelterById,
  updateOwnerShelter: mockUpdateOwnerShelter,
  appendShelterPhoto: vi.fn(),
  removeShelterPhoto: vi.fn(),
  getShelterPhotos: vi.fn(),
  shelterPhotoUrl: vi.fn((p: string) => `https://supabase.co/storage/v1/object/public/shelter-photos/${p}`),
  extractPhotoPath: vi.fn((url: string) => url.split("shelter-photos/")[1] ?? null),
  isOwnerPhotoPath: vi.fn((path: string, shelterDbId: string) => path.startsWith(`owner/${shelterDbId}/`)),
}));

const mockGetSessionUser = vi.mocked(
  (await import("@/utils/supabase/server-session")).getSessionUser
);

// ─── GET /api/ejer/shelters ───────────────────────────────────────────────────
describe("GET /api/ejer/shelters", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns shelters for authenticated user", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetSheltersByAuthUser.mockResolvedValueOnce([
      { id: "s-1", title: "Hedeskoven", active_booking_count: 2 },
    ]);
    const { GET } = await import("../ejer/shelters/route");
    const req = new NextRequest("http://localhost/api/ejer/shelters");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shelters).toHaveLength(1);
    expect(body.shelters[0].title).toBe("Hedeskoven");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSessionUser.mockResolvedValueOnce(null);
    const { GET } = await import("../ejer/shelters/route");
    const req = new NextRequest("http://localhost/api/ejer/shelters");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/ejer/shelter/[id] ─────────────────────────────────────────────
describe("PATCH /api/ejer/shelter/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates fields when user owns the shelter", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce({ id: "s-1", title: "Old", auth_user_id: "user-1" });
    mockUpdateOwnerShelter.mockResolvedValueOnce({ id: "s-1", title: "New Title" });

    const { PATCH } = await import("../ejer/shelter/[id]/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shelter.title).toBe("New Title");
  });

  it("returns 403 when shelter belongs to another user", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce(null); // not found for this user

    const { PATCH } = await import("../ejer/shelter/[id]/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-99", {
      method: "PATCH",
      body: JSON.stringify({ title: "Hack" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s-99" }) });
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSessionUser.mockResolvedValueOnce(null);
    const { PATCH } = await import("../ejer/shelter/[id]/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(401);
  });

  it("rejects negative price", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce({ id: "s-1", auth_user_id: "user-1" });

    const { PATCH } = await import("../ejer/shelter/[id]/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-1", {
      method: "PATCH",
      body: JSON.stringify({ shelter_price_dkk: -10 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect failures on missing route files**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Create `web/app/api/ejer/shelters/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const shelters = await getSheltersByAuthUser(user.id);
  return NextResponse.json({ shelters });
}
```

- [ ] **Step 4: Create `web/app/api/ejer/shelter/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, updateOwnerShelter, type OwnerShelterUpdate } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const update: OwnerShelterUpdate = {};

  if ("title" in b) {
    const t = typeof b.title === "string" ? b.title.trim() : "";
    if (!t || t.length > 100) {
      return NextResponse.json({ error: "Titel skal være 1–100 tegn" }, { status: 400 });
    }
    update.title = t;
  }

  if ("description" in b) {
    const d = typeof b.description === "string" ? b.description.trim() : "";
    if (d.length > 2000) {
      return NextResponse.json({ error: "Beskrivelse må højst være 2000 tegn" }, { status: 400 });
    }
    update.description = d;
  }

  if ("max_persons" in b) {
    const n = Number(b.max_persons);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "Maks. personer skal være 1–50" }, { status: 400 });
    }
    update.max_persons = n;
  }

  if ("shelter_price_dkk" in b) {
    const raw = b.shelter_price_dkk;
    const p = raw === null ? null : Number(raw);
    if (p !== null && (isNaN(p) || p < 0 || p > 9999)) {
      return NextResponse.json({ error: "Pris skal være 0–9999 kr" }, { status: 400 });
    }
    update.shelter_price_dkk = p;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Ingen felter at opdatere" }, { status: 400 });
  }

  const updated = await updateOwnerShelter(id, update);
  if (!updated) return NextResponse.json({ error: "Opdatering fejlede" }, { status: 500 });

  return NextResponse.json({ ok: true, shelter: updated });
}
```

- [ ] **Step 5: Run tests — expect all to pass**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/api/ejer/shelters/route.ts "web/app/api/ejer/shelter/[id]/route.ts" web/app/api/__tests__/ejer.test.ts
git commit -m "feat: shelter data API routes for owner portal (GET shelters, PATCH shelter)"
```

---

## Task 7: Image Upload/Delete API

**Files:**
- Create: `web/app/api/ejer/shelter/[id]/billeder/route.ts`
- Modify: `web/app/api/__tests__/ejer.test.ts` (add tests)

> **Note on DELETE body:** The spec says `{ path: string }` but this plan uses `{ url: string }` (the full public URL). Sending the full URL is safer — the server extracts the storage path via `extractPhotoPath()`. The `ShelterEditForm` and route are consistent with each other on `{ url }`.

- [ ] **Step 1: Add tests for image routes to `ejer.test.ts`**

```typescript
// ─── POST + DELETE /api/ejer/shelter/[id]/billeder ───────────────────────────
describe("POST /api/ejer/shelter/[id]/billeder", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 403 when user doesn't own the shelter", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce(null);

    const { POST } = await import("../ejer/shelter/[id]/billeder/route");
    const formData = new FormData();
    formData.append("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-99/billeder", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, { params: Promise.resolve({ id: "s-99" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when shelter has no shelter_id", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce({ id: "s-1", shelter_id: null });

    const { POST } = await import("../ejer/shelter/[id]/billeder/route");
    const formData = new FormData();
    formData.append("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-1/billeder", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ikke linket/i);
  });
});

describe("DELETE /api/ejer/shelter/[id]/billeder", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 403 when path doesn't belong to the shelter", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce({ id: "s-1", shelter_id: "db-1" });

    // isOwnerPhotoPath returns false (wrong shelter)
    const ownerDb = await import("@/lib/owner-db");
    vi.mocked(ownerDb.isOwnerPhotoPath).mockReturnValueOnce(false);
    vi.mocked(ownerDb.extractPhotoPath).mockReturnValueOnce("owner/other-shelter/uuid.jpg");

    const { DELETE } = await import("../ejer/shelter/[id]/billeder/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/s-1/billeder", {
      method: "DELETE",
      body: JSON.stringify({ url: "https://supabase.co/storage/v1/object/public/shelter-photos/owner/other-shelter/uuid.jpg" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Create `web/app/api/ejer/shelter/[id]/billeder/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  getOwnerShelterById,
  appendShelterPhoto,
  removeShelterPhoto,
  shelterPhotoUrl,
  extractPhotoPath,
  isOwnerPhotoPath,
} from "@/lib/owner-db";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-photos";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  if (!shelter.shelter_id) {
    return NextResponse.json(
      { error: "Sheltet er ikke linket til kataloget — kontakt admin" },
      { status: 400 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vælg et billede" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "Kun JPEG, PNG og WebP understøttes" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Billedet må højst være 5 MB" }, { status: 400 });
  }

  const ext = EXT[file.type] ?? "jpg";
  const filePath = `owner/${shelter.shelter_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await createAdminClient().storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Owner photo upload error:", uploadError);
    return NextResponse.json({ error: "Upload fejlede — prøv igen" }, { status: 500 });
  }

  const url = shelterPhotoUrl(filePath);
  await appendShelterPhoto(shelter.shelter_id, url);

  return NextResponse.json({ ok: true, url, path: filePath });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  if (!shelter.shelter_id) {
    return NextResponse.json({ error: "Sheltet er ikke linket til kataloget" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const url = typeof (body as Record<string, unknown>).url === "string"
    ? (body as Record<string, unknown>).url as string
    : "";

  if (!url) {
    return NextResponse.json({ error: "Mangler url" }, { status: 400 });
  }

  const path = extractPhotoPath(url);
  if (!path || !isOwnerPhotoPath(path, shelter.shelter_id)) {
    return NextResponse.json({ error: "Ikke tilladt at slette dette billede" }, { status: 403 });
  }

  await createAdminClient().storage.from(BUCKET).remove([path]);
  await removeShelterPhoto(shelter.shelter_id, url);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/ejer.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "web/app/api/ejer/shelter/[id]/billeder/route.ts" web/app/api/__tests__/ejer.test.ts
git commit -m "feat: image upload/delete API for owner portal"
```

---

## Task 8: Owner Portal Pages

**Files:**
- Create: `web/app/ejer/layout.tsx`
- Create: `web/app/ejer/login/page.tsx`
- Create: `web/app/ejer/signup/page.tsx`
- Create: `web/app/ejer/dashboard/page.tsx`
- Create: `web/app/ejer/shelter/[id]/rediger/page.tsx`
- Create: `web/components/ejer/LoginForm.tsx`
- Create: `web/components/ejer/SignupForm.tsx`
- Create: `web/components/ejer/ShelterEditForm.tsx`

Note: Pages under `app/ejer/` are outside `(site)` — they use the root layout (fonts, cookie banner) but NOT the Navbar/Footer.

- [ ] **Step 1: Create `web/app/ejer/layout.tsx`**

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Ejer-portal | ShelterDK" },
  robots: { index: false, follow: false },
};

export default function EjerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="border-b border-primary/10 bg-white px-5 py-4 flex items-center justify-between">
        <a href="/" className="font-serif font-bold text-lg text-primary tracking-tight">
          ShelterDK
        </a>
        <span className="text-xs text-primary/40 uppercase tracking-widest font-semibold">Ejer-portal</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/components/ejer/LoginForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ejer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      const next = searchParams.get("next") ?? "/ejer/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Noget gik galt — prøv igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-serif text-2xl font-bold text-primary mb-1">Log ind</h1>
      <p className="text-sm text-primary/50 mb-8">Ejer-portal · ShelterDK</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Email</label>
          <input
            type="email" required autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Adgangskode</label>
          <input
            type="password" required autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-accent text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
        >
          {loading ? "Logger ind…" : "Log ind"}
        </button>
        <p className="text-center text-sm text-primary/50">
          Ingen konto?{" "}
          <a href="/ejer/signup" className="text-accent hover:underline">Opret her</a>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create `web/app/ejer/login/page.tsx`**

```typescript
import { Suspense } from "react";
import { LoginForm } from "@/components/ejer/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 4: Create `web/components/ejer/SignupForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ejer/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      if (data.sheltersLinked === 0) {
        setError("Vi fandt ingen shelter med denne email. Kontakt os på kontakt@shelterdk.dk, så linker vi din konto manuelt.");
        return;
      }
      router.push("/ejer/dashboard");
      router.refresh();
    } catch {
      setError("Noget gik galt — prøv igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-serif text-2xl font-bold text-primary mb-1">Opret konto</h1>
      <p className="text-sm text-primary/50 mb-8">Brug den email der er tilknyttet dit shelter</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Email</label>
          <input
            type="email" required autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
            Adgangskode <span className="normal-case font-normal text-primary/35">mindst 8 tegn</span>
          </label>
          <input
            type="password" required autoComplete="new-password" minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-accent text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
        >
          {loading ? "Opretter konto…" : "Opret konto"}
        </button>
        <p className="text-center text-sm text-primary/50">
          Har du allerede en konto?{" "}
          <a href="/ejer/login" className="text-accent hover:underline">Log ind</a>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create `web/app/ejer/signup/page.tsx`**

```typescript
import { SignupForm } from "@/components/ejer/SignupForm";

export default function SignupPage() {
  return <SignupForm />;
}
```

- [ ] **Step 6: Create `web/app/ejer/dashboard/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export default async function EjerDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const shelters = await getSheltersByAuthUser(user.id);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Ejer-portal</p>
          <h1 className="font-serif text-2xl font-bold text-primary">Mine shelters</h1>
          <p className="text-sm text-primary/50 mt-1">{user.email}</p>
        </div>
        <form action="/api/ejer/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-primary/40 hover:text-primary border border-primary/15 rounded-lg px-3 py-1.5 transition-colors"
          >
            Log ud
          </button>
        </form>
      </div>

      {shelters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/15 p-8 text-center">
          <p className="text-sm text-primary/50">Ingen shelters fundet. Kontakt os på kontakt@shelterdk.dk.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shelters.map((shelter) => (
            <div
              key={shelter.id}
              className="rounded-2xl border border-primary/8 bg-white p-5 flex items-center justify-between gap-4"
            >
              <div>
                <h2 className="font-semibold text-primary">{shelter.title}</h2>
                <p className="text-xs text-primary/40 mt-0.5">
                  {shelter.active_booking_count > 0
                    ? `${shelter.active_booking_count} aktive bookinger`
                    : "Ingen aktive bookinger"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/ejer/shelter/${shelter.id}/rediger`}
                  className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors"
                >
                  Rediger
                </Link>
                <Link
                  href={`/owner/${shelter.owner_token}`}
                  className="text-sm font-medium text-primary/60 border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  Bookinger
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create `web/components/ejer/ShelterEditForm.tsx`**

```typescript
"use client";

import { useState, useRef } from "react";
import type { BookableShelter } from "@/types/booking";

interface Props {
  shelter: BookableShelter;
  photos: string[];          // current user_image_urls from shelters table
  shelterDbId: string;       // shelters.id (= bookable_shelters.shelter_id) for ownership check
}

export function ShelterEditForm({ shelter, photos: initialPhotos, shelterDbId }: Props) {
  const [form, setForm] = useState({
    title: shelter.title ?? "",
    description: shelter.description ?? "",
    max_persons: shelter.max_persons,
    shelter_price_dkk: shelter.shelter_price_dkk ?? 0,
  });
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/ejer/shelter/${shelter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Noget gik galt"); return; }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Noget gik galt — prøv igen");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/ejer/shelter/${shelter.id}/billeder`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload fejlede"); return; }
      setPhotos((prev) => [...prev, data.url]);
    } catch {
      setUploadError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm("Slet dette billede?")) return;
    try {
      await fetch(`/api/ejer/shelter/${shelter.id}/billeder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setPhotos((prev) => prev.filter((u) => u !== url));
    } catch {
      // Best-effort
    }
  }

  const isOwnerPhoto = (url: string) => url.includes(`/owner/${shelterDbId}/`);

  return (
    <div>
      <div className="mb-6">
        <a href="/ejer/dashboard" className="text-sm text-primary/40 hover:text-primary transition-colors">
          ← Tilbage til dashboard
        </a>
        <h1 className="font-serif text-2xl font-bold text-primary mt-2">{shelter.title}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-5 bg-white rounded-2xl border border-primary/8 p-5 mb-6">
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-widest">Shelter-info</h2>

        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Titel *</label>
          <input
            type="text" required maxLength={100}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Beskrivelse</label>
          <textarea
            maxLength={2000} rows={5}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
          <p className="text-xs text-primary/30 mt-1">{form.description.length}/2000</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Maks. personer</label>
            <input
              type="number" min={1} max={50} required
              value={form.max_persons}
              onChange={(e) => setForm((f) => ({ ...f, max_persons: Number(e.target.value) }))}
              className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Pris pr. nat (kr)</label>
            <input
              type="number" min={0} max={9999}
              value={form.shelter_price_dkk}
              onChange={(e) => setForm((f) => ({ ...f, shelter_price_dkk: Number(e.target.value) }))}
              className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
        </div>

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">Gemt ✓</div>
        )}

        <button
          type="submit" disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-accent text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
        >
          {saving ? "Gemmer…" : "Gem ændringer"}
        </button>
      </form>

      {/* Photo gallery */}
      <div className="bg-white rounded-2xl border border-primary/8 p-5">
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-widest mb-4">Billeder</h2>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {photos.map((url) => (
              <div key={url} className="relative group aspect-video rounded-xl overflow-hidden bg-primary/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {isOwnerPhoto(url) && (
                  <button
                    onClick={() => handleDeletePhoto(url)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Slet billede"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-primary/40 mb-4">Ingen billeder endnu.</p>
        )}

        {shelter.shelter_id ? (
          <>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/15 rounded-xl p-6 cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <span className="text-2xl mb-2">{uploading ? "⏳" : "📷"}</span>
              <span className="text-sm font-medium text-primary/60">
                {uploading ? "Uploader…" : "Klik for at tilføje billede"}
              </span>
              <span className="text-xs text-primary/30 mt-1">JPEG, PNG eller WebP · maks. 5 MB</span>
            </label>
            {uploadError && (
              <p className="text-sm text-red-600 mt-2">{uploadError}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-primary/40 italic">
            Billedupload kræver at sheltet er linket til kataloget — kontakt admin.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `web/app/ejer/shelter/[id]/rediger/page.tsx`**

```typescript
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, getShelterPhotos } from "@/lib/owner-db";
import { ShelterEditForm } from "@/components/ejer/ShelterEditForm";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function RedigerPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) notFound();

  const photos = shelter.shelter_id
    ? await getShelterPhotos(shelter.shelter_id)
    : [];

  return (
    <ShelterEditForm
      shelter={shelter}
      photos={photos}
      shelterDbId={shelter.shelter_id ?? ""}
    />
  );
}
```

- [ ] **Step 9: Run full test suite**

```bash
cd /Users/CKA/shelterdk/web && npm test 2>&1 | tail -20
```
Expected: all tests PASS, no new failures.

- [ ] **Step 10: Run build check**

```bash
cd /Users/CKA/shelterdk/web && npm run build 2>&1 | grep -E "error|Error|✓|✗" | head -20
```
Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add web/app/ejer/ web/components/ejer/
git commit -m "feat: owner portal pages (login, signup, dashboard, shelter edit)"
```

---

## Task 9: Push and Verify

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Disable email confirmation in Supabase (if not done)**

Open Supabase dashboard → Authentication → Providers → Email → toggle off "Confirm email".

- [ ] **Step 3: Manually test the full flow**

1. Go to `https://shelterdk.dk/ejer/signup`
2. Sign up with the email on one of the `bookable_shelters` rows (e.g., Kim's email)
3. Verify redirect to `/ejer/dashboard` and shelter appears
4. Click "Rediger" → edit title → save → verify title updated in DB
5. Upload a photo → verify it appears in gallery and on the shelter's public page
6. Delete the uploaded photo → verify it's removed
7. Log out → verify redirect to `/ejer/login`
8. Verify `/owner/[token]` still works for existing token holders

- [ ] **Step 4: Run tests one final time**

```bash
cd /Users/CKA/shelterdk/web && npm test 2>&1 | tail -5
```
Expected: all PASS.
