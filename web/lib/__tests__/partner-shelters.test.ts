import { describe, it, expect } from "vitest";
import { partnerAdsLink, PARTNER_SHELTERS, formatDkk, isPriceStale } from "@/lib/partner-shelters";

describe("partnerAdsLink", () => {
  it("bygger et Partner-ads deep link med partner- og banner-id", () => {
    expect(partnerAdsLink("https://solundhuse.dk/produkt/shelter-udeliv/")).toBe(
      "https://www.partner-ads.com/dk/klikbanner.php?partnerid=19557&bannerid=110103&htmlurl=https://solundhuse.dk/produkt/shelter-udeliv/"
    );
  });
  it("afviser URL'er uden for annoncørens domæne", () => {
    expect(() => partnerAdsLink("https://example.com/noget")).toThrow(/solundhuse/);
  });
});

describe("PARTNER_SHELTERS", () => {
  it("har mindst ét shelter med pris og produkt-URL", () => {
    expect(PARTNER_SHELTERS.length).toBeGreaterThan(0);
    for (const p of PARTNER_SHELTERS) {
      expect(p.priceDkk).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\/solundhuse\.dk\/produkt\//);
      expect(p.name.length).toBeGreaterThan(3);
    }
  });
  it("er sorteret med billigste først, så prisspændet læses oppefra", () => {
    const priser = PARTNER_SHELTERS.filter((p) => !p.accessory).map((p) => p.priceDkk);
    expect([...priser].sort((a, b) => a - b)).toEqual(priser);
  });
});

describe("formatDkk", () => {
  it("bruger dansk tusindtalsseparator og kr-suffiks", () => {
    expect(formatDkk(18999)).toBe("18.999 kr.");
    expect(formatDkk(4199)).toBe("4.199 kr.");
  });
});

describe("isPriceStale", () => {
  it("er sand når priserne ikke er tjekket i over 60 dage", () => {
    expect(isPriceStale("2026-01-01", new Date("2026-09-21"))).toBe(true);
    expect(isPriceStale("2026-09-01", new Date("2026-09-21"))).toBe(false);
  });
});
