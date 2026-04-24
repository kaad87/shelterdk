import { describe, it, expect, vi, beforeEach } from "vitest";

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
  getBookableShelterByOwnerToken: mockGetBookableShelterByOwnerToken,
  getBookingByIdForShelter: mockGetBookingByIdForShelter,
  getBookingsForShelter: mockGetBookingsForShelter,
  blockDate: mockBlockDate,
  unblockDate: mockUnblockDate,
}));

vi.mock("@/lib/booking-email", () => ({
  sendBookingRequestToOwner: mockSendBookingRequestToOwner,
  sendBookingReceivedToGuest: mockSendBookingReceivedToGuest,
  sendBookingConfirmedToGuest: mockSendBookingConfirmedToGuest,
  sendBookingRejectedToGuest: mockSendBookingRejectedToGuest,
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
    mockMarkTokenUsed.mockResolvedValue(undefined);
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
