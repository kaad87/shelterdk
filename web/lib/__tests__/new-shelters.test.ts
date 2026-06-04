import { describe, it, expect } from "vitest";
import { isNewShelter, isPresentableShelter, newShelterHref, NEW_SHELTER_DAYS } from "@/lib/new-shelters";
import type { Shelter } from "@/types/shelter";

const NOW = Date.UTC(2026, 5, 4); // fast referencepunkt
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function shelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "x",
    title: "Test",
    slug: "test-shelter",
    description: "En fin beskrivelse der er lang nok til at tælle.",
    image_url: "https://example.com/billede.jpg",
    ...overrides,
  } as Shelter;
}

describe("isNewShelter", () => {
  it("ny inden for 14 dage", () => {
    expect(isNewShelter({ created_at: daysAgo(3) }, NOW)).toBe(true);
    expect(isNewShelter({ created_at: daysAgo(NEW_SHELTER_DAYS - 1) }, NOW)).toBe(true);
  });
  it("ikke ny når ældre end vinduet", () => {
    expect(isNewShelter({ created_at: daysAgo(NEW_SHELTER_DAYS + 1) }, NOW)).toBe(false);
  });
  it("false uden created_at eller ugyldig dato", () => {
    expect(isNewShelter({ created_at: undefined }, NOW)).toBe(false);
    expect(isNewShelter({ created_at: "ikke-en-dato" }, NOW)).toBe(false);
  });
  it("false for fremtidig dato (urealistisk)", () => {
    expect(isNewShelter({ created_at: daysAgo(-5) }, NOW)).toBe(false);
  });
});

describe("isPresentableShelter", () => {
  it("true med billede + reel beskrivelse", () => {
    expect(isPresentableShelter(shelter())).toBe(true);
  });
  it("false uden noget billede", () => {
    expect(isPresentableShelter(shelter({ image_url: null, image_urls: null, user_image_urls: null, google_place_id: null, google_places: undefined }))).toBe(false);
  });
  it("false med billede men for kort/ingen beskrivelse", () => {
    expect(isPresentableShelter(shelter({ description: "kort" }))).toBe(false);
    expect(isPresentableShelter(shelter({ description: null }))).toBe(false);
  });
  it("true når kun Google-foto (photo_references) + beskrivelse", () => {
    const s = shelter({ image_url: null, image_urls: null, user_image_urls: null, google_place_id: "abc", google_places: { photo_references: ["ref1"] } as Shelter["google_places"] });
    expect(isPresentableShelter(s)).toBe(true);
  });
});

describe("newShelterHref", () => {
  it("region 'Danmark' → /shelter/[slug]", () => {
    expect(newShelterHref({ slug: "s", region: "Danmark", kommune: null })).toBe("/shelter/s");
  });
  it("tom region → /shelter/[slug]", () => {
    expect(newShelterHref({ slug: "s", region: null, kommune: null })).toBe("/shelter/s");
  });
  it("rigtig region + kommune → silo-URL", () => {
    expect(newShelterHref({ slug: "s", region: "Jylland", kommune: "Aarhus" })).toBe("/danmark/jylland/aarhus/s");
  });
  it("rigtig region uden kommune → ukendt-kommune", () => {
    expect(newShelterHref({ slug: "s", region: "Fyn", kommune: null })).toBe("/danmark/fyn/ukendt-kommune/s");
  });
});
