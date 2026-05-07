import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateBooking = vi.fn();
const mockGetAuthenticatedOwnerContext = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/booking-db", () => ({
  createBooking: mockCreateBooking,
}));

vi.mock("@/lib/ejer-auth", () => ({
  getAuthenticatedOwnerContext: mockGetAuthenticatedOwnerContext,
}));

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("POST /api/ejer/shelter/[id]/bookinger/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a confirmed owner_manual booking", async () => {
    mockGetAuthenticatedOwnerContext.mockResolvedValueOnce({
      shelter: { id: "shelter-1", max_persons: 6 },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "shelter_bookings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "shelter_blocked_dates") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateBooking.mockResolvedValueOnce({
      id: "booking-1",
      guest_name: "Lars",
      status: "confirmed",
      source: "owner_manual",
    });

    const { POST } = await import("../ejer/shelter/[id]/bookinger/manual/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/shelter-1/bookinger/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_name: "Lars",
        guest_email: "lars@test.dk",
        guest_count: 2,
        check_in: "2026-06-10",
        check_out: "2026-06-12",
        message: "Booket via telefon",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "shelter-1" }) });
    expect(res.status).toBe(201);
    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_name: "Lars",
        status: "confirmed",
        source: "owner_manual",
      })
    );
  });

  it("rejects overlapping bookings", async () => {
    mockGetAuthenticatedOwnerContext.mockResolvedValueOnce({
      shelter: { id: "shelter-1", max_persons: 6 },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "shelter_bookings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [{ id: "existing" }], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("../ejer/shelter/[id]/bookinger/manual/route");
    const req = new NextRequest("http://localhost/api/ejer/shelter/shelter-1/bookinger/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_name: "Lars",
        guest_count: 2,
        check_in: "2026-06-10",
        check_out: "2026-06-12",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "shelter-1" }) });
    expect(res.status).toBe(409);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});
