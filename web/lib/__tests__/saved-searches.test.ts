import { describe, expect, it } from "vitest";
import {
  buildSavedSearchUrl,
  describeSavedSearch,
  generateSavedSearchToken,
  isValidEmailFormat,
  matchesSavedSearch,
} from "@/lib/saved-searches";
import type { Shelter } from "@/types/shelter";

function mkShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "s1",
    slug: "s1",
    title: "Test Shelter",
    description: null,
    location: null,
    image_url: null,
    region: "Jylland",
    kommune: "Aarhus",
    booking_url: null,
    duplicate_of_shelter_id: null,
    water: false,
    toilet: null,
    capacity: null,
    google_user_ratings_total: 0,
    geofa_raw: {},
    ...overrides,
  } as Shelter;
}

describe("isValidEmailFormat", () => {
  it("accepterer normale adresser", () => {
    expect(isValidEmailFormat("a@b.dk")).toBe(true);
    expect(isValidEmailFormat("test.user+tag@eksempel.co.uk")).toBe(true);
  });
  it("afviser åbenlyse fejl", () => {
    expect(isValidEmailFormat("")).toBe(false);
    expect(isValidEmailFormat("plain")).toBe(false);
    expect(isValidEmailFormat("a@b")).toBe(false);
    expect(isValidEmailFormat("@b.dk")).toBe(false);
    expect(isValidEmailFormat("a@.dk")).toBe(false);
  });
});

describe("generateSavedSearchToken", () => {
  it("genererer URL-safe tokens af forventet længde", () => {
    const t = generateSavedSearchToken();
    expect(t.length).toBeGreaterThanOrEqual(30);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("genererer unikke tokens", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateSavedSearchToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("describeSavedSearch", () => {
  it("beskriver tom søgning med fallback til 'i hele Danmark'", () => {
    expect(describeSavedSearch({ region: null, q: null, area: null, filters: {} })).toBe("i hele Danmark");
  });
  it("inkluderer region og filtre", () => {
    const desc = describeSavedSearch({
      region: "Jylland",
      q: null,
      area: null,
      filters: { bookbar: true, vand: true },
    });
    expect(desc).toContain("Jylland");
    expect(desc).toContain("bookbar");
    expect(desc).toContain("vand");
  });
  it("inkluderer fritekst", () => {
    expect(describeSavedSearch({ region: null, q: "Bornholm", area: null, filters: {} })).toContain('"Bornholm"');
  });
  it("inkluderer min_pladser", () => {
    const desc = describeSavedSearch({
      region: null,
      q: null,
      area: null,
      filters: { min_pladser: 8 },
    });
    expect(desc).toContain("8 pladser");
  });
});

describe("buildSavedSearchUrl", () => {
  it("genererer ren URL uden filtre", () => {
    expect(
      buildSavedSearchUrl("https://shelterdk.dk", { region: null, q: null, area: null, filters: {} })
    ).toBe("https://shelterdk.dk/soeg");
  });
  it("inkluderer alle aktive filtre", () => {
    const url = buildSavedSearchUrl("https://shelterdk.dk", {
      region: "Jylland",
      q: null,
      area: null,
      filters: { bookbar: true, vand: true, min_pladser: 4 },
    });
    expect(url).toContain("region=Jylland");
    expect(url).toContain("bookbar=1");
    expect(url).toContain("vand=1");
    expect(url).toContain("min_pladser=4");
  });
});

describe("matchesSavedSearch", () => {
  it("returnerer true når filters er null", () => {
    expect(matchesSavedSearch(mkShelter(), null)).toBe(true);
  });
  it("respekterer vand-filter", () => {
    expect(matchesSavedSearch(mkShelter({ water: true }), { vand: true })).toBe(true);
    expect(matchesSavedSearch(mkShelter({ water: false }), { vand: true })).toBe(false);
  });
  it("respekterer toilet-filter (accepterer flush + mulch)", () => {
    expect(matchesSavedSearch(mkShelter({ toilet: "flush" }), { toilet: true })).toBe(true);
    expect(matchesSavedSearch(mkShelter({ toilet: "mulch" }), { toilet: true })).toBe(true);
    expect(matchesSavedSearch(mkShelter({ toilet: "none" }), { toilet: true })).toBe(false);
  });
  it("respekterer hund via geofa_raw", () => {
    expect(
      matchesSavedSearch(mkShelter({ geofa_raw: { hunde_tilladt: "Ja" } }), { hund: true })
    ).toBe(true);
    expect(
      matchesSavedSearch(mkShelter({ geofa_raw: { hunde_tilladt: "Nej" } }), { hund: true })
    ).toBe(false);
  });
  it("respekterer min_pladser", () => {
    expect(matchesSavedSearch(mkShelter({ capacity: 8 }), { min_pladser: 6 })).toBe(true);
    expect(matchesSavedSearch(mkShelter({ capacity: 4 }), { min_pladser: 6 })).toBe(false);
    expect(matchesSavedSearch(mkShelter({ capacity: null }), { min_pladser: 6 })).toBe(false);
  });
  it("respekterer anmeldelser-filter", () => {
    expect(
      matchesSavedSearch(mkShelter({ google_user_ratings_total: 5 }), { anmeldelser: true })
    ).toBe(true);
    expect(
      matchesSavedSearch(mkShelter({ google_user_ratings_total: 0 }), { anmeldelser: true })
    ).toBe(false);
  });
});
