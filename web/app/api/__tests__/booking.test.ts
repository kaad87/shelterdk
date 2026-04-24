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
