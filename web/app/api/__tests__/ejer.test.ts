import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock Supabase SSR session client ─────────────────────────────────────────
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResolveOwnerClaim = vi.fn();
const mockConsumeOwnerClaimToken = vi.fn();

vi.mock("@/utils/supabase/server-session", () => ({
  createSessionClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      getUser: mockGetUser,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
  getSessionUser: vi.fn(),
}));

// ─── Mock admin client for signup shelter-linking ─────────────────────────────
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockStorageFrom = vi.fn();
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  })),
}));

vi.mock("@/lib/owner-claim", () => ({
  normalizeClaimToken: (value: string) => value.trim(),
  resolveOwnerClaim: mockResolveOwnerClaim,
  consumeOwnerClaimToken: mockConsumeOwnerClaimToken,
}));

// ─── Default rate-limit RPC response so route handlers don't fail ────────────
function allowRateLimit() {
  // `enforcePublicRateLimit` calls `.rpc("consume_public_rate_limit", …)`
  // and destructures { data, error } — we provide an allowing response so
  // the rest of the handler logic gets to run.
  mockRpc.mockImplementation((name: string) => {
    if (name === "consume_public_rate_limit") {
      return Promise.resolve({
        data: [{ allowed: true, hits: 1, retry_after_seconds: 60 }],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

// ─── Login route ──────────────────────────────────────────────────────────────
describe("POST /api/ejer/login", () => {
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

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

  it("returns 400 when password is missing", async () => {
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
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("returns 200 and links shelters on valid signup", async () => {
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: { shelterId: "shelter-1", ownerEmail: "kim@test.dk", authUserId: null, claimTokenId: "claim-1" },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [{ id: "shelter-1" }], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "new-user-1", email: "kim@test.dk" }, session: {} },
      error: null,
    });

    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123", claim_token: "owner-token-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockConsumeOwnerClaimToken).toHaveBeenCalledWith("claim-1");
  });

  it("returns 409 if email already registered", async () => {
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: { shelterId: "shelter-1", ownerEmail: "existing@test.dk", authUserId: null, claimTokenId: "claim-1" },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {};
      }
      throw new Error(`Unexpected table ${table}`);
    });
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "existing@test.dk", password: "secret123", claim_token: "owner-token-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 403 when claim token does not match email", async () => {
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: { shelterId: "shelter-1", ownerEmail: "another@test.dk", authUserId: null, claimTokenId: "claim-1" },
      error: null,
    });
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123", claim_token: "owner-token-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 409 when claim already belongs to another account", async () => {
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: { shelterId: "shelter-1", ownerEmail: "kim@test.dk", authUserId: "user-existing", claimTokenId: "claim-1" },
      error: null,
    });
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123", claim_token: "claim-token-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is too short", async () => {
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "abc", claim_token: "owner-token-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when claim token is missing", async () => {
    const { POST } = await import("../ejer/signup/route");
    const req = new NextRequest("http://localhost/api/ejer/signup", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk", password: "secret123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Password reset route ────────────────────────────────────────────────────
describe("POST /api/ejer/password-reset", () => {
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("sends reset email for valid address", async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const { POST } = await import("../ejer/password-reset/route");
    const req = new NextRequest("http://localhost/api/ejer/password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "kim@test.dk" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "kim@test.dk",
      { redirectTo: "http://localhost/ejer/nulstil-adgangskode" }
    );
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("../ejer/password-reset/route");
    const req = new NextRequest("http://localhost/api/ejer/password-reset", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

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

// Need to re-import getSessionUser mock after owner-db mock is set up
const { getSessionUser: mockGetSessionUser } = await import("@/utils/supabase/server-session");
const mockGetSessionUserFn = vi.mocked(mockGetSessionUser);

// ─── GET /api/ejer/shelters ───────────────────────────────────────────────────
describe("GET /api/ejer/shelters", () => {
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("returns shelters for authenticated user", async () => {
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
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
    mockGetSessionUserFn.mockResolvedValueOnce(null);
    const { GET } = await import("../ejer/shelters/route");
    const req = new NextRequest("http://localhost/api/ejer/shelters");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/ejer/shelter/[id] ─────────────────────────────────────────────
describe("PATCH /api/ejer/shelter/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("updates fields when user owns the shelter", async () => {
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
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
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce(null);

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
    mockGetSessionUserFn.mockResolvedValueOnce(null);
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
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
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

// ─── POST + DELETE /api/ejer/shelter/[id]/billeder ───────────────────────────
describe("POST /api/ejer/shelter/[id]/billeder", () => {
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("returns 403 when user doesn't own the shelter", async () => {
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
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
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
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
  beforeEach(() => { vi.clearAllMocks(); allowRateLimit(); });

  it("returns 403 when photo path doesn't belong to the shelter", async () => {
    mockGetSessionUserFn.mockResolvedValueOnce({ id: "user-1", email: "kim@test.dk" });
    mockGetOwnerShelterById.mockResolvedValueOnce({ id: "s-1", shelter_id: "db-1" });

    const ownerDb = await import("@/lib/owner-db");
    vi.mocked(ownerDb.extractPhotoPath).mockReturnValueOnce("owner/other-shelter/uuid.jpg");
    vi.mocked(ownerDb.isOwnerPhotoPath).mockReturnValueOnce(false);

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
