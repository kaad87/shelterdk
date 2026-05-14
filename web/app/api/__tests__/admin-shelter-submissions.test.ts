// web/app/api/__tests__/admin-shelter-submissions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ADMIN_SECRET = "test-admin-secret";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockSelectEq = vi.fn();
const mockUpdateEq = vi.fn();
const mockInsert = vi.fn();

// Storage mock
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url/photo.jpg" }, error: null });
const mockDownload = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://public.url/photo.jpg" } });
const mockRemoveStorage = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: mockSelectEq,
      update: mockUpdateEq,
      insert: mockInsert,
    }),
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: mockCreateSignedUrl,
        download: mockDownload,
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemoveStorage,
      }),
    },
  }),
}));

vi.mock("@/lib/email", () => ({
  sendShelterApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendShelterRejectedEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Route imports ────────────────────────────────────────────────────────────

const { GET } = await import("../admin/pending-shelter-submissions/route");
const approveModule = await import("../admin/approve-shelter-submission/route");
const rejectModule = await import("../admin/reject-shelter-submission/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── GET /api/admin/pending-shelter-submissions ───────────────────────────────

describe("GET /api/admin/pending-shelter-submissions", () => {
  beforeEach(() => {
    mockSelectEq.mockReset();
    mockCreateSignedUrl.mockReset();
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.url/photo.jpg" }, error: null });
    mockSelectEq.mockReturnValue({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await GET(unauthorizedRequest("GET", "/api/admin/pending-shelter-submissions") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer submissions array ved succes", async () => {
    const fakeRow = {
      id: VALID_UUID,
      type: "user_tip",
      shelter_name: "Test",
      status: "pending",
      photo_urls: [],
      created_at: new Date().toISOString(),
    };
    mockSelectEq.mockReturnValue({
      eq: () => ({ order: () => Promise.resolve({ data: [fakeRow], error: null }) }),
    });
    const res = await GET(adminRequest("GET", "/api/admin/pending-shelter-submissions") as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submissions).toHaveLength(1);
    expect(json.submissions[0].photo_preview_urls).toEqual([]);
  });

  it("genererer signed preview URLs for fotos", async () => {
    const fakeRow = {
      id: VALID_UUID,
      type: "owner_registration",
      shelter_name: "Test",
      status: "pending",
      photo_urls: ["pending/abc.jpg"],
      created_at: new Date().toISOString(),
    };
    mockSelectEq.mockReturnValue({
      eq: () => ({ order: () => Promise.resolve({ data: [fakeRow], error: null }) }),
    });
    const res = await GET(adminRequest("GET", "/api/admin/pending-shelter-submissions") as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submissions[0].photo_preview_urls).toEqual(["https://signed.url/photo.jpg"]);
  });
});

// ─── POST /api/admin/approve-shelter-submission ───────────────────────────────

describe("POST /api/admin/approve-shelter-submission", () => {
  const fakeSubmission = {
    id: VALID_UUID,
    shelter_name: "Skovhytten",
    description: "Fin hytte",
    capacity: 6,
    facilities: { vand: true, baalplads: true, hunde_tilladt: false },
    booking_url: null,
    contact_email: "test@example.com",
    photo_urls: [],
  };

  beforeEach(() => {
    mockSelectEq.mockReset();
    mockUpdateEq.mockReset();
    mockInsert.mockReset();

    // Default: fetch submission succeeds
    mockSelectEq.mockReturnValue({
      eq: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: fakeSubmission, error: null }),
        }),
      }),
    });

    // Default: shelter insert succeeds
    mockInsert.mockResolvedValue({ error: null });

    // Default: update submission status succeeds (1 row updated)
    mockUpdateEq.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => Promise.resolve({ data: [{ id: VALID_UUID }], error: null }),
        }),
      }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await approveModule.POST(unauthorizedRequest("POST", "/api/admin/approve-shelter-submission") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer 400 uden submissionId", async () => {
    const res = await approveModule.POST(adminRequest("POST", "/api/admin/approve-shelter-submission", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden region", async () => {
    const res = await approveModule.POST(adminRequest("POST", "/api/admin/approve-shelter-submission", {
      submissionId: VALID_UUID,
      lat: 55.67,
      lng: 12.56,
    }) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden gyldige koordinater", async () => {
    const res = await approveModule.POST(adminRequest("POST", "/api/admin/approve-shelter-submission", {
      submissionId: VALID_UUID,
      region: "Sjælland",
      lat: 999,
      lng: 12.56,
    }) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 200 ved godkendelse med alle påkrævede felter", async () => {
    const res = await approveModule.POST(adminRequest("POST", "/api/admin/approve-shelter-submission", {
      submissionId: VALID_UUID,
      region: "Sjælland",
      kommune: "Gribskov",
      place: "Esrum",
      lat: 56.07,
      lng: 12.31,
    }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.slug).toMatch(/^skovhytten-/);
  });
});

// ─── POST /api/admin/reject-shelter-submission ────────────────────────────────

describe("POST /api/admin/reject-shelter-submission", () => {
  const fakeSubmission = {
    id: VALID_UUID,
    shelter_name: "Test Shelter",
    contact_email: "test@example.com",
    photo_urls: [],
  };

  beforeEach(() => {
    mockSelectEq.mockReset();
    mockUpdateEq.mockReset();

    // Default: fetch submission succeeds
    mockSelectEq.mockReturnValue({
      eq: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: fakeSubmission, error: null }),
        }),
      }),
    });

    // Default: update succeeds and affects 1 row
    mockUpdateEq.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => Promise.resolve({ data: [{ id: VALID_UUID }], error: null }),
        }),
      }),
    });
  });

  it("returnerer 401 uden admin-secret", async () => {
    const res = await rejectModule.POST(unauthorizedRequest("POST", "/api/admin/reject-shelter-submission") as never);
    expect(res.status).toBe(401);
  });

  it("returnerer 400 uden submissionId", async () => {
    const res = await rejectModule.POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden afvisningsårsag", async () => {
    const res = await rejectModule.POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {
      submissionId: VALID_UUID,
    }) as never);
    expect(res.status).toBe(400);
  });

  it("returnerer 409 hvis ansøgning allerede er behandlet (0 rækker opdateret)", async () => {
    mockUpdateEq.mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });
    const res = await rejectModule.POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {
      submissionId: VALID_UUID,
      reason: "Duplikat",
    }) as never);
    expect(res.status).toBe(409);
  });

  it("returnerer 200 ved afvisning med årsag", async () => {
    const res = await rejectModule.POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {
      submissionId: VALID_UUID,
      reason: "Duplikat shelter",
    }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
