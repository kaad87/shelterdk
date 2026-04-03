import { describe, it, expect } from "vitest";
import {
  stripHtml,
  getLocationCoords,
  getDisplayScore,
  hasAnyImage,
  isValidImageUrl,
  getLongDescription,
  getCity,
  getOwner,
} from "../shelter-detail";
import type { Shelter } from "@/types/shelter";

function mk(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "1",
    title: "Test",
    slug: "test",
    description: null,
    location: null,
    image_url: null,
    google_rating: null,
    google_user_ratings_total: null,
    booking_url: null,
    duplicate_of_shelter_id: null,
    ...overrides,
  } as Shelter;
}

describe("stripHtml", () => {
  it("returnerer null for tom/null/undefined", () => {
    expect(stripHtml(null)).toBe(null);
    expect(stripHtml("")).toBe(null);
    expect(stripHtml(undefined)).toBe(null);
  });

  it("fjerner br-tags", () => {
    expect(stripHtml("Linje1<br>Linje2")).toBe("Linje1\nLinje2");
  });

  it("fjerner p-tags", () => {
    expect(stripHtml("<p>Tekst</p>")).toContain("Tekst");
  });

  it("erstatter non-breaking space", () => {
    expect(stripHtml("Tekst\u00a0her")).toBe("Tekst her");
  });
});

describe("getLocationCoords", () => {
  it("returnerer null for tom location", () => {
    expect(getLocationCoords(mk({ location: null }))).toBe(null);
  });

  it("parser POINT(lon lat) format", () => {
    const s = mk({ location: "POINT(9.5 56.2)" });
    expect(getLocationCoords(s)).toEqual({ lon: 9.5, lat: 56.2 });
  });

  it("parser GeoJSON coordinates", () => {
    const s = mk({ location: { coordinates: [10.0, 55.5] } as unknown as string });
    expect(getLocationCoords(s)).toEqual({ lon: 10.0, lat: 55.5 });
  });
});

describe("getDisplayScore", () => {
  it("returnerer 0 for tom shelter", () => {
    expect(getDisplayScore(mk())).toBe(0);
  });

  it("tæller billeder med 100 pr stk", () => {
    expect(getDisplayScore(mk({ image_url: "https://example.com/1.jpg" }))).toBe(100);
  });

  it("tilføjer anmeldelser (max 500)", () => {
    const s = mk({
      image_url: "https://x.com/1.jpg",
      google_user_ratings_total: 50,
    });
    expect(getDisplayScore(s)).toBe(150);
  });
});

describe("hasAnyImage", () => {
  it("returnerer false uden billede", () => {
    expect(hasAnyImage(mk())).toBe(false);
  });

  it("returnerer true med image_url", () => {
    expect(hasAnyImage(mk({ image_url: "https://example.com/img.jpg" }))).toBe(true);
  });
});

describe("isValidImageUrl", () => {
  it("afviser tom/null", () => {
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl("")).toBe(false);
  });

  it("afviser HTML", () => {
    expect(isValidImageUrl("<a>link</a>")).toBe(false);
  });

  it("accepterer https-URL", () => {
    expect(isValidImageUrl("https://example.com/image.jpg")).toBe(true);
  });
});

describe("getLongDescription", () => {
  it("returnerer fra geofa_raw lang_beskr", () => {
    const s = mk({ geofa_raw: { lang_beskr: "<p>Beskrivelse</p>" } });
    expect(getLongDescription(s)).toContain("Beskrivelse");
  });
});

describe("getCity", () => {
  it("returnerer place når sat", () => {
    expect(getCity(mk({ place: "Brønderslev" }))).toBe("Brønderslev");
  });

  it("returnerer kommune når place mangler", () => {
    expect(getCity(mk({ kommune: "Brønderslev Kommune" }))).toBe("Brønderslev");
  });
});

describe("getOwner", () => {
  it("returnerer ansvar_org fra geofa_raw", () => {
    const s = mk({ geofa_raw: { ansvar_org: "Naturstyrelsen" } });
    expect(getOwner(s)).toBe("Naturstyrelsen");
  });
});
