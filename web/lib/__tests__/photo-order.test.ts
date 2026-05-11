import { describe, it, expect } from "vitest";
import { getPhotoUrls, getOrderedPhotoItems } from "@shared/lib/shelter-detail";
import type { Shelter } from "@shared/types/shelter";

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "shelter-1",
    title: "Test Shelter",
    slug: "test-shelter",
    description: null,
    location: null,
    image_url: null,
    google_rating: null,
    google_user_ratings_total: null,
    booking_url: null,
    duplicate_of_shelter_id: null,
    ...overrides,
  };
}

const URL_A = "https://example.com/a.jpg";
const URL_B = "https://example.com/b.jpg";
const URL_C = "https://example.com/c.jpg";
const URL_OWNER = "https://supabase.co/storage/v1/object/public/shelter-photos/owner/shelter-1/x.jpg";
const URL_GEOFA = "https://example.com/geofa.jpg";

describe("getPhotoUrls() — backward compat (no photo_order)", () => {
  it("returns empty array when no photos", () => {
    expect(getPhotoUrls(makeShelter())).toEqual([]);
  });

  it("merges image_url + image_urls + user_image_urls in order", () => {
    const s = makeShelter({ image_url: URL_A, image_urls: [URL_B], user_image_urls: [URL_C] });
    expect(getPhotoUrls(s)).toEqual([URL_A, URL_B, URL_C]);
  });

  it("deduplicates URLs", () => {
    const s = makeShelter({ image_url: URL_A, image_urls: [URL_A, URL_B] });
    expect(getPhotoUrls(s)).toEqual([URL_A, URL_B]);
  });

  it("reads geofa_raw GEOFA_PHOTO_KEYS", () => {
    const s = makeShelter({ geofa_raw: { foto_link: URL_GEOFA } });
    expect(getPhotoUrls(s)).toContain(URL_GEOFA);
  });
});

describe("getPhotoUrls() — with photo_order", () => {
  it("uses photo_order as the base display order", () => {
    const s = makeShelter({
      image_url: URL_A,
      user_image_urls: [URL_B],
      photo_order: [URL_B, URL_A],
    });
    expect(getPhotoUrls(s)).toEqual([URL_B, URL_A]);
  });

  it("appends new URLs not in photo_order", () => {
    const s = makeShelter({
      image_url: URL_A,
      image_urls: [URL_B],
      user_image_urls: [URL_C],
      photo_order: [URL_A, URL_B],
    });
    expect(getPhotoUrls(s)).toEqual([URL_A, URL_B, URL_C]);
  });

  it("prunes stale URLs from photo_order", () => {
    const STALE = "https://example.com/stale.jpg";
    const s = makeShelter({
      image_url: URL_A,
      photo_order: [STALE, URL_A],
    });
    expect(getPhotoUrls(s)).toEqual([URL_A]);
  });

  it("falls back to canonical order when photo_order is empty array", () => {
    const s = makeShelter({ image_url: URL_A, user_image_urls: [URL_B], photo_order: [] });
    expect(getPhotoUrls(s)).toEqual([URL_A, URL_B]);
  });

  it("falls back to canonical order when photo_order is null", () => {
    const s = makeShelter({ image_url: URL_A, user_image_urls: [URL_B], photo_order: null });
    expect(getPhotoUrls(s)).toEqual([URL_A, URL_B]);
  });
});

describe("getOrderedPhotoItems()", () => {
  const SHELTER_DB_ID = "shelter-1";

  it("returns PhotoItems with correct isDeletable flags", () => {
    const s = makeShelter({
      image_url: URL_A,
      user_image_urls: [URL_OWNER],
    });
    const items = getOrderedPhotoItems(s, SHELTER_DB_ID);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.url === URL_A)?.isDeletable).toBe(false);
    expect(items.find(i => i.url === URL_OWNER)?.isDeletable).toBe(true);
  });

  it("returns the full list without SKIP_FIRST_IMAGES slicing", () => {
    const s = makeShelter({
      slug: "shelterplads-med-balplads-og-borde-og-baenke-14806",
      image_url: URL_A,
      image_urls: [URL_B, URL_C],
    });
    // getPhotoUrls() skips first 4 → returns [] since only 3 photos
    expect(getPhotoUrls(s)).toEqual([]);
    // getOrderedPhotoItems() does NOT skip
    expect(getOrderedPhotoItems(s, "other-id").map(i => i.url)).toEqual([URL_A, URL_B, URL_C]);
  });

  it("respects photo_order for initial ordering", () => {
    const s = makeShelter({
      image_url: URL_A,
      user_image_urls: [URL_OWNER],
      photo_order: [URL_OWNER, URL_A],
    });
    const items = getOrderedPhotoItems(s, SHELTER_DB_ID);
    expect(items[0].url).toBe(URL_OWNER);
    expect(items[1].url).toBe(URL_A);
  });
});
