import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stripe mocks (stripe package not installed in test env) ──────────────────
vi.mock("stripe", () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        retrieve: vi.fn().mockResolvedValue({ url: "https://stripe.com/pay", payment_intent: { id: "pi_test" } }),
        create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://stripe.com/pay" }),
      },
    };
    refunds = { create: vi.fn().mockResolvedValue({ id: "re_test" }) };
    webhooks = { constructEvent: vi.fn() };
  },
}));

vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ url: "https://stripe.com/pay", sessionId: "cs_test" }),
  calculateFee: vi.fn().mockReturnValue({ shelterDkk: 100, platformDkk: 25, totalDkk: 125 }),
  calculateBookingAmounts: vi.fn().mockReturnValue({ nights: 2, shelterDkk: 200, platformDkk: 25, totalDkk: 225 }),
  calculateBookingNights: vi.fn().mockReturnValue(2),
  constructWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/payment-db", () => ({
  createBookingPayment: vi.fn().mockResolvedValue(undefined),
  getPaymentByBookingId: vi.fn().mockResolvedValue(null),
  getPaymentBySessionId: vi.fn().mockResolvedValue(null),
  markPaymentPaid: vi.fn().mockResolvedValue(undefined),
  expireOldPayments: vi.fn().mockResolvedValue([]),
}));

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGetBookableShelterBySlug = vi.fn();
const mockGetUnavailableDates = vi.fn();
const mockCreateBooking = vi.fn();
const mockCreateActionTokens = vi.fn();
const mockSendBookingRequestToOwner = vi.fn();
const mockSendBookingReceivedToGuest = vi.fn();
const mockResolveActionToken = vi.fn();
const mockMarkTokenUsed = vi.fn();
const mockUpdateBookingStatus = vi.fn();
const mockHasConfirmedOverlap = vi.fn();
const mockCancelPendingBooking = vi.fn();
const mockSendBookingConfirmedToGuest = vi.fn();
const mockSendBookingRejectedToGuest = vi.fn();
const mockGetBookableShelterByOwnerToken = vi.fn();
const mockGetBookingByIdForShelter = vi.fn();
const mockGetBookingsForShelter = vi.fn();
const mockBlockDate = vi.fn();
const mockUnblockDate = vi.fn();

vi.mock("@/lib/booking-db", () => ({
  getBookableShelterBySlug: mockGetBookableShelterBySlug,
  getUnavailableDates: mockGetUnavailableDates,
  createBooking: mockCreateBooking,
  createActionTokens: mockCreateActionTokens,
  resolveActionToken: mockResolveActionToken,
  markTokenUsed: mockMarkTokenUsed,
  updateBookingStatus: mockUpdateBookingStatus,
  hasConfirmedOverlap: mockHasConfirmedOverlap,
  cancelPendingBooking: mockCancelPendingBooking,
  getBookableShelterByOwnerToken: mockGetBookableShelterByOwnerToken,
  getBookingByIdForShelter: mockGetBookingByIdForShelter,
  getBookingsForShelter: mockGetBookingsForShelter,
  blockDate: mockBlockDate,
  unblockDate: mockUnblockDate,
}));

// ── Supabase admin client mock (used by sendAutoMessageIfEnabled) ─────────────
vi.mock("@/utils/supabase/server-admin", () => {
  const chain = { data: null, error: null };
  const qb: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "neq", "is", "in", "lt", "gt", "gte", "lte", "insert", "update", "delete", "upsert", "order", "single", "maybeSingle"];
  for (const m of methods) {
    qb[m] = vi.fn(() => ({ ...qb, ...chain }));
  }
  return { createAdminClient: vi.fn(() => qb) };
});

vi.mock("@/lib/booking-email", () => ({
  sendBookingRequestToOwner: mockSendBookingRequestToOwner,
  sendBookingReceivedToGuest: mockSendBookingReceivedToGuest,
  sendBookingConfirmedToGuest: mockSendBookingConfirmedToGuest,
  sendBookingRejectedToGuest: mockSendBookingRejectedToGuest,
  sendPaymentRequestToGuest: vi.fn().mockResolvedValue(undefined),
  sendRefundedToGuest: vi.fn().mockResolvedValue(undefined),
  sendUpfrontPaymentReceived: vi.fn().mockResolvedValue(undefined),
  sendPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
  sendBookingExpired: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockShelter(overrides = {}) {
  return {
    id: "shelter-uuid-1",
    slug: "test-shelter",
    title: "Test Shelter",
    owner_email: "ejer@test.dk",
    owner_token: "owner-token-1",
    max_persons: 6,
    ...overrides,
  };
}

function mockBooking(overrides = {}) {
  return {
    id: "booking-uuid-1",
    bookable_shelter_id: "shelter-uuid-1",
    guest_name: "Lars",
    guest_email: "lars@test.dk",
    guest_count: 2,
    check_in: "2026-06-01",
    check_out: "2026-06-03",
    message: null,
    status: "pending",
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
    ...overrides,
  };
}

// ── GET /api/book/[slug]/availability ─────────────────────────────────────────
describe("GET /api/book/[slug]/availability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 404 for ukendt slug", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(null);
    const { GET } = await import("../book/[slug]/availability/route");
    const res = await GET(
      new Request("http://localhost/api/book/ukendt/availability") as never,
      { params: Promise.resolve({ slug: "ukendt" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returnerer availability dates for kendt shelter", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    mockGetUnavailableDates.mockResolvedValue({
      "2026-06-01": "confirmed",
      "2026-06-10": "pending",
    });
    const { GET } = await import("../book/[slug]/availability/route");
    const res = await GET(
      new Request("http://localhost/api/book/test-shelter/availability") as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dates["2026-06-01"]).toBe("confirmed");
    expect(body.dates["2026-06-10"]).toBe("pending");
  });
});

// ── POST /api/book/[slug] ─────────────────────────────────────────────────────
describe("POST /api/book/[slug]", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    guest_name: "Lars",
    guest_email: "lars@test.dk",
    guest_count: 2,
    check_in: "2027-06-01",
    check_out: "2027-06-03",
    accepted_terms: true,
  };

  it("returnerer 404 for ukendt shelter", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(null);
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/ukendt", {
        method: "POST", body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "ukendt" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returnerer 400 ved ugyldig email", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify({ ...validBody, guest_email: "ikke-en-email" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("email") });
  });

  it("returnerer 400 når check_out er før check_in", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify({ ...validBody, check_in: "2027-06-05", check_out: "2027-06-03" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returnerer 400 når bookingvilkår ikke er accepteret", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify({ ...validBody, accepted_terms: false }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("bookingvilkårene"),
    });
  });

  it("opretter booking og returnerer 201 ved gyldigt input", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    mockCreateBooking.mockResolvedValue(mockBooking({ check_in: "2027-06-01", check_out: "2027-06-03" }));
    mockCreateActionTokens.mockResolvedValue({ confirmToken: "ct", rejectToken: "rt" });
    mockSendBookingRequestToOwner.mockResolvedValue(undefined);
    mockSendBookingReceivedToGuest.mockResolvedValue(undefined);
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockCreateBooking).toHaveBeenCalledOnce();
    expect(mockSendBookingRequestToOwner).toHaveBeenCalledOnce();
    expect(mockSendBookingReceivedToGuest).toHaveBeenCalledOnce();
  });

  it("gemmer upfront betaling med total for alle nætter", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(
      mockShelter({ payment_mode: "upfront", shelter_price_dkk: 100, platform_fee_pct: 5, platform_fee_min_dkk: 25 })
    );
    mockCreateBooking.mockResolvedValue(
      mockBooking({ check_in: "2027-06-01", check_out: "2027-06-03" })
    );
    mockCreateActionTokens.mockResolvedValue({ confirmToken: "ct", rejectToken: "rt" });
    mockSendBookingRequestToOwner.mockResolvedValue(undefined);
    mockSendBookingReceivedToGuest.mockResolvedValue(undefined);

    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );

    expect(res.status).toBe(201);
    const { createBookingPayment } = await import("@/lib/payment-db");
    expect(createBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-uuid-1",
        amountTotalDkk: 225,
        amountShelterDkk: 200,
        amountPlatformDkk: 25,
      })
    );
  });

  it("annullerer pending upfront-booking hvis checkout ikke kan oprettes", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(
      mockShelter({ payment_mode: "upfront", shelter_price_dkk: 100, platform_fee_pct: 5, platform_fee_min_dkk: 25 })
    );
    mockCreateBooking.mockResolvedValue(
      mockBooking({ check_in: "2027-06-01", check_out: "2027-06-03" })
    );
    mockCancelPendingBooking.mockResolvedValue(true);

    const stripe = await import("@/lib/stripe");
    vi.mocked(stripe.createCheckoutSession).mockRejectedValueOnce(new Error("stripe down"));

    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("betalingen"),
    });
    expect(mockCancelPendingBooking).toHaveBeenCalledWith("booking-uuid-1");
  });
});

// ── GET /api/booking/action/[token] ──────────────────────────────────────────
describe("GET /api/booking/action/[token]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirecter til not_found for ukendt token", async () => {
    mockResolveActionToken.mockResolvedValue(null);
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("not_found");
  });

  it("redirecter til already_used for brugt token", async () => {
    mockResolveActionToken.mockResolvedValue({
      token: { id: "t1", action: "confirm", used_at: "2026-04-24T00:00:00Z", expires_at: "2026-05-01T00:00:00Z" },
      booking: mockBooking({ status: "pending" }),
      shelter: mockShelter(),
    });
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "brugt" }) }
    );
    expect(res.headers.get("location")).toContain("already_used");
  });

  it("bekræfter booking og redirecter til confirmed", async () => {
    mockResolveActionToken.mockResolvedValue({
      token: { id: "t1", action: "confirm", used_at: null, expires_at: "2099-01-01T00:00:00Z" },
      booking: mockBooking({ status: "pending" }),
      shelter: mockShelter(),
    });
    mockHasConfirmedOverlap.mockResolvedValue(false);
    mockMarkTokenUsed.mockResolvedValue(true);
    mockUpdateBookingStatus.mockResolvedValue(undefined);
    mockSendBookingConfirmedToGuest.mockResolvedValue(undefined);
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "confirm-token" }) }
    );
    expect(res.headers.get("location")).toContain("confirmed");
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("booking-uuid-1", "confirmed");
  });
});

// ── GET /api/owner/[token]/bookings ───────────────────────────────────────────
describe("GET /api/owner/[token]/bookings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { GET } = await import("../owner/[token]/bookings/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returnerer bookings for gyldigt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingsForShelter.mockResolvedValue([mockBooking()]);
    const { GET } = await import("../owner/[token]/bookings/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings).toHaveLength(1);
  });
});

// ── POST /api/owner/[token]/block ─────────────────────────────────────────────
describe("POST /api/owner/[token]/block", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/block/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ date: "2026-06-01" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("blokerer en dato og returnerer ok", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockBlockDate.mockResolvedValue(undefined);
    const { POST } = await import("../owner/[token]/block/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ date: "2026-06-01" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockBlockDate).toHaveBeenCalledWith("shelter-uuid-1", "2026-06-01", null);
  });
});

// ── POST /api/owner/[token]/action ────────────────────────────────────────────
describe("POST /api/owner/[token]/action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "b1", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returnerer 404 for booking der ikke tilhører shelteret", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingByIdForShelter.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "fremmed-booking", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("bekræfter booking og returnerer ok", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingByIdForShelter.mockResolvedValue(mockBooking({ status: "pending" }));
    mockHasConfirmedOverlap.mockResolvedValue(false);
    mockUpdateBookingStatus.mockResolvedValue(undefined);
    mockSendBookingConfirmedToGuest.mockResolvedValue(undefined);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "booking-uuid-1", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("booking-uuid-1", "confirmed");
  });
});
