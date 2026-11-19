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
  getResolvedBookingModel,
  isBookable,
  getResolvedPhotoUrls,
  getResolvedDisplayImageUrl,
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

describe("booking model", () => {
  it("prioriterer ShelterDK-bookingenheder som internal booking", () => {
    const shelter = mk({
      bookable_shelters: [{ id: "unit-1" }],
      booking_url: null,
    });
    const model = getResolvedBookingModel(shelter);
    expect(model.provider).toBe("shelterdk");
    expect(model.linkMode).toBe("internal");
    expect(isBookable(shelter)).toBe(true);
  });

  it("genkender direkte Naturstyrelsen-link som external_direct", () => {
    const shelter = mk({
      booking_url: "https://book.naturstyrelsen.dk/sted/jomfruhale-shelterplads/",
    });
    const model = getResolvedBookingModel(shelter);
    expect(model.provider).toBe("naturstyrelsen");
    expect(model.linkMode).toBe("external_direct");
    expect(model.lookupKey).toBe("jomfruhale-shelterplads");
  });

  it("falder tilbage til external_search for bookbare NST-shelters uden konkret URL", () => {
    const shelter = mk({
      geofa_raw: {
        book: "Ja",
        ansvar_org: "Naturstyrelsen",
      },
    });
    const model = getResolvedBookingModel(shelter);
    expect(model.provider).toBe("naturstyrelsen");
    expect(model.linkMode).toBe("external_search");
    expect(model.fallbackHint).toBe("naturstyrelsen");
  });
});

describe("getResolvedPhotoUrls (Google-billeder sidst)", () => {
  // Google-billeder er døde i prod (19/11 2026): /api/google-photo svarer 503
  // uden nøgle, photo_reference giver 400, og lagrede lh3 place-photos-URL'er
  // giver 403. Et stabilt billede (GeoFA/udinaturen/bruger) skal derfor stå forrest.
  const LH3 = "https://lh3.googleusercontent.com/place-photos/AL8-SNabc=s1600-w1200";
  const GEOFA = "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/foto.jpg";
  const REF = "ATCDNfUG_fJECsSdvz-gyJW1Sl3LHDzVF";
  const PROXY = `/api/google-photo?ref=${REF}&maxwidth=1200`;

  it("stabilt billede foran Google-proxy når begge findes", () => {
    const s = mk({ image_urls: [LH3, GEOFA] });
    expect(getResolvedPhotoUrls(s, REF)).toEqual([GEOFA, PROXY]);
    expect(getResolvedDisplayImageUrl(s, REF)).toBe(GEOFA);
  });

  it("embedded photo_references giver samme rækkefølge", () => {
    const s = mk({
      image_urls: [LH3, GEOFA],
      google_places: { photo_references: [REF] } as Shelter["google_places"],
    });
    expect(getResolvedPhotoUrls(s)[0]).toBe(GEOFA);
  });

  it("kun Google: proxy erstatter lh3 som før", () => {
    expect(getResolvedPhotoUrls(mk({ image_urls: [LH3] }), REF)).toEqual([PROXY]);
  });

  it("uden ref: stabilt billede foran lh3", () => {
    expect(getResolvedPhotoUrls(mk({ image_urls: [LH3, GEOFA] }))).toEqual([GEOFA, LH3]);
  });

  it("ikke-Google først: uændret", () => {
    expect(getResolvedPhotoUrls(mk({ image_urls: [GEOFA, LH3] }), REF)).toEqual([GEOFA, LH3]);
  });
});
