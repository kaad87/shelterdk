import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructWebhookEvent = vi.fn();
const mockGetPaymentBySessionId = vi.fn();
const mockMarkPaymentPaid = vi.fn();
const mockMarkPaymentExpired = vi.fn();
const mockSendPaymentConfirmed = vi.fn();
const mockSendBookingExpired = vi.fn();
const mockUpdateBookingStatus = vi.fn();
const mockCancelPendingBooking = vi.fn();

vi.mock("@/lib/stripe", () => ({
  constructWebhookEvent: mockConstructWebhookEvent,
}));

vi.mock("@/lib/payment-db", () => ({
  getPaymentBySessionId: mockGetPaymentBySessionId,
  markPaymentPaid: mockMarkPaymentPaid,
  markPaymentExpired: mockMarkPaymentExpired,
}));

vi.mock("@/lib/booking-email", () => ({
  sendPaymentConfirmed: mockSendPaymentConfirmed,
  sendBookingExpired: mockSendBookingExpired,
}));

vi.mock("@/lib/booking-db", () => ({
  updateBookingStatus: mockUpdateBookingStatus,
  cancelPendingBooking: mockCancelPendingBooking,
}));

vi.mock("@/lib/server-analytics", () => ({
  sendGa4Event: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => {
            if (table === "shelter_bookings") {
              return {
                data: {
                  guest_email: "guest@test.dk",
                  guest_name: "Lars",
                  guest_token: "guest-token-1",
                  check_in: "2027-06-01",
                  check_out: "2027-06-03",
                  bookable_shelters: {
                    owner_email: "owner@test.dk",
                    owner_token: "owner-token-1",
                    title: "Test Shelter",
                    payment_mode: "upfront",
                  },
                },
              };
            }
            return { data: null };
          }),
        })),
      })),
    })),
  })),
}));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-bekræfter upfront booking ved completed checkout", async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test" } },
    });
    mockGetPaymentBySessionId.mockResolvedValue({
      id: "payment-1",
      booking_id: "booking-1",
      status: "pending",
      paid_at: null,
      amount_total_dkk: 225,
    });

    const { POST } = await import("../stripe/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig_test" },
      }) as never
    );

    expect(res.status).toBe(200);
    expect(mockMarkPaymentPaid).toHaveBeenCalledWith("payment-1");
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("booking-1", "confirmed");
    expect(mockSendPaymentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        guestEmail: "guest@test.dk",
        ownerEmail: "owner@test.dk",
        shelterTitle: "Test Shelter",
        amountTotalDkk: 225,
      })
    );
  });

  it("udløber og annullerer pending checkout med det samme", async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: { object: { id: "cs_expired" } },
    });
    mockGetPaymentBySessionId.mockResolvedValue({
      id: "payment-2",
      booking_id: "booking-2",
      status: "pending",
      amount_total_dkk: 225,
    });
    mockCancelPendingBooking.mockResolvedValue(true);

    const { POST } = await import("../stripe/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig_test" },
      }) as never
    );

    expect(res.status).toBe(200);
    expect(mockMarkPaymentExpired).toHaveBeenCalledWith("payment-2");
    expect(mockCancelPendingBooking).toHaveBeenCalledWith("booking-2");
    expect(mockSendBookingExpired).toHaveBeenCalledWith(
      expect.objectContaining({
        guestEmail: "guest@test.dk",
        ownerEmail: "owner@test.dk",
        shelterTitle: "Test Shelter",
      })
    );
  });
});
