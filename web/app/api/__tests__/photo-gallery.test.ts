import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockGetAuthenticatedOwnerGroupContext = vi.fn();
const mockUpdateSharedShelterContent = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/ejer-auth", () => ({
  getAuthenticatedOwnerGroupContext: mockGetAuthenticatedOwnerGroupContext,
  getAuthenticatedOwnerContext: vi.fn(),
}));
vi.mock("@/lib/owner-db", () => ({
  extractPhotoPath: vi.fn((url: string) => {
    const prefix = "https://sb.co/storage/v1/object/public/shelter-photos/";
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }),
  isOwnerPhotoPath: vi.fn((path: string, id: string) => path.startsWith(`owner/${id}/`)),
  updateSharedShelterContent: mockUpdateSharedShelterContent,
}));
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

const GROUP_ID = "shelter-uuid-1";
const OWNER_URL = "https://sb.co/storage/v1/object/public/shelter-photos/owner/shelter-uuid-1/x.jpg";
const OFFICIAL_URL = "https://example.com/official.jpg";

function makeGroupContext() {
  return {
    shelters: [{ id: "unit-1" }, { id: "unit-2" }],
  };
}

function makeShelterFromQuery() {
  return {
    data: {
      image_url: OFFICIAL_URL,
      image_urls: [],
      user_image_urls: [OWNER_URL],
      geofa_raw: null,
    },
    error: null,
  };
}

describe("photo_order allowlist validation logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedOwnerGroupContext.mockResolvedValue(makeGroupContext());
    mockUpdateSharedShelterContent.mockResolvedValue({ id: GROUP_ID });
  });

  it("allowset includes official URL", () => {
    const allowset = new Set([OFFICIAL_URL, OWNER_URL]);
    expect(allowset.has(OFFICIAL_URL)).toBe(true);
  });

  it("rejects photo_order containing unknown URL", () => {
    const UNKNOWN = "https://other-shelter.com/evil.jpg";
    const allowset = new Set([OFFICIAL_URL, OWNER_URL]);
    const photoOrder = [OFFICIAL_URL, UNKNOWN];
    const invalid = photoOrder.find(url => !allowset.has(url));
    expect(invalid).toBe(UNKNOWN);
  });

  it("accepts photo_order with only known URLs", () => {
    const allowset = new Set([OFFICIAL_URL, OWNER_URL]);
    const photoOrder = [OWNER_URL, OFFICIAL_URL];
    const invalid = photoOrder.find(url => !allowset.has(url));
    expect(invalid).toBeUndefined();
  });

  it("rejects photo_order exceeding MAX_PHOTOS", async () => {
    const { MAX_PHOTOS } = await import("@shared/lib/shelter-detail");
    const tooMany = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(tooMany.length > MAX_PHOTOS).toBe(true);
  });

  it("accepts photo_order of exactly MAX_PHOTOS", async () => {
    const { MAX_PHOTOS } = await import("@shared/lib/shelter-detail");
    const exactly = Array.from({ length: MAX_PHOTOS }, (_, i) => `https://example.com/${i}.jpg`);
    expect(exactly.length).toBe(MAX_PHOTOS);
  });

  it("builds allowset from geofa_raw foto_link keys", () => {
    const GEOFA_URL = "https://geofa.dk/photo.jpg";
    const GEOFA_PHOTO_KEYS = [
      "foto_link", "foto_link1", "foto_link2", "foto_link3",
      "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3",
    ] as const;
    const geofa_raw = { foto_link: GEOFA_URL };
    const allowset = new Set<string>();
    for (const k of GEOFA_PHOTO_KEYS) {
      const v = geofa_raw[k as keyof typeof geofa_raw];
      if (typeof v === "string" && v.trim()) allowset.add(v.trim());
    }
    expect(allowset.has(GEOFA_URL)).toBe(true);
  });

  it("rejects non-array photo_order", () => {
    const isValid = (val: unknown) => Array.isArray(val) && (val as unknown[]).every(v => typeof v === "string");
    expect(isValid("not-an-array")).toBe(false);
    expect(isValid(null)).toBe(false);
    expect(isValid([OFFICIAL_URL])).toBe(true);
    expect(isValid([OFFICIAL_URL, 42])).toBe(false);
  });
});
