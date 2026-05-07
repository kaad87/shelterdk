import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSessionUser = vi.fn();
const mockResolveOwnerClaim = vi.fn();
const mockConsumeOwnerClaimToken = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/server-session", () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock("@/lib/owner-claim", () => ({
  normalizeClaimToken: (value: string) => value,
  resolveOwnerClaim: mockResolveOwnerClaim,
  consumeOwnerClaimToken: mockConsumeOwnerClaimToken,
}));

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("POST /api/ejer/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links shelters after a valid accepted invite", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "ejer@test.dk" });
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: {
        shelterId: "shelter-1",
        ownerEmail: "ejer@test.dk",
        authUserId: null,
        claimTokenId: "claim-1",
      },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [{ id: "shelter-1" }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("../ejer/claim/route");
    const req = new NextRequest("http://localhost/api/ejer/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_token: "claim-token-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sheltersLinked).toBe(1);
    expect(mockConsumeOwnerClaimToken).toHaveBeenCalledWith("claim-1");
  });

  it("rejects a claim when logged-in email does not match invite email", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "user-1", email: "forkert@test.dk" });
    mockResolveOwnerClaim.mockResolvedValueOnce({
      claim: {
        shelterId: "shelter-1",
        ownerEmail: "ejer@test.dk",
        authUserId: null,
        claimTokenId: "claim-1",
      },
      error: null,
    });

    const { POST } = await import("../ejer/claim/route");
    const req = new NextRequest("http://localhost/api/ejer/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_token: "claim-token-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
