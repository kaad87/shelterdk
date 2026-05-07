import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();
const mockSendOwnerPortalInviteEmail = vi.fn();
const mockCreateOwnerClaimToken = vi.fn();

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/email", () => ({
  sendOwnerPortalInviteEmail: mockSendOwnerPortalInviteEmail,
}));

vi.mock("@/lib/owner-claim", () => ({
  createOwnerClaimToken: mockCreateOwnerClaimToken,
}));

describe("PATCH /api/admin/shelters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = "super-secret";
  });

  it("sends owner invite email with signup link", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "s-1",
                  title: "Skovly Shelter",
                  owner_email: "ejer@test.dk",
                  owner_token: "owner-token-1",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateOwnerClaimToken.mockResolvedValueOnce({
      id: "claim-1",
      token: "claim-token-1",
      expires_at: "2026-06-01T12:00:00.000Z",
    });

    const { PATCH } = await import("../admin/shelters/route");
    const req = new NextRequest("http://localhost/api/admin/shelters", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "super-secret",
      },
      body: JSON.stringify({ id: "s-1", action: "send_invite" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockSendOwnerPortalInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "ejer@test.dk",
        shelterTitle: "Skovly Shelter",
        signupUrl: "http://localhost/ejer/signup?claim=claim-token-1&email=ejer%40test.dk",
      })
    );
  });

  it("blocks direct linking of existing users", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "s-1",
                  title: "Skovly Shelter",
                  owner_email: "ejer@test.dk",
                  owner_token: "owner-token-1",
                  auth_user_id: null,
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "s-1", auth_user_id: "user-1" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { PATCH } = await import("../admin/shelters/route");
    const req = new NextRequest("http://localhost/api/admin/shelters", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "super-secret",
      },
      body: JSON.stringify({ id: "s-1", action: "link_existing_user" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/invite-flowet/i);
  });

  it("clears auth binding when owner email changes", async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "s-1", owner_email: "ny@test.dk", auth_user_id: null },
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "bookable_shelters") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "s-1",
                  owner_email: "old@test.dk",
                  owner_token: "owner-token-1",
                  auth_user_id: "user-1",
                },
                error: null,
              }),
            }),
          }),
          update: updateSpy,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { PATCH } = await import("../admin/shelters/route");
    const req = new NextRequest("http://localhost/api/admin/shelters", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "super-secret",
      },
      body: JSON.stringify({
        id: "s-1",
        action: "update_owner_email",
        owner_email: "ny@test.dk",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ owner_email: "ny@test.dk", auth_user_id: null });
  });
});
