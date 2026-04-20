// web/app/api/__tests__/admin-shelter-submissions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ADMIN_SECRET = "test-admin-secret";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: mockSelect,
      update: mockUpdate,
    }),
  }),
}));

// Top-level imports (outside describe blocks)
const { GET } = await import("../admin/pending-shelter-submissions/route");
const approveModule = await import("../admin/approve-shelter-submission/route");
const rejectModule = await import("../admin/reject-shelter-submission/route");

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
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

  it("returnerer 200 ved godkendelse", async () => {
    const res = await approveModule.POST(adminRequest("POST", "/api/admin/approve-shelter-submission", { submissionId: "abc-123" }) as never);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/reject-shelter-submission", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

  it("returnerer 200 ved afvisning", async () => {
    const res = await rejectModule.POST(adminRequest("POST", "/api/admin/reject-shelter-submission", {
      submissionId: "abc-123",
      reason: "Duplikat"
    }) as never);
    expect(res.status).toBe(200);
  });
});
