import { describe, it, expect } from "vitest";
import { slugifySegment, segmentSlugToName } from "../slug";

describe("slugifySegment", () => {
  it("returnerer tom streng for null/undefined", () => {
    expect(slugifySegment(null)).toBe("");
    expect(slugifySegment(undefined)).toBe("");
    expect(slugifySegment("")).toBe("");
  });

  it("konverterer til lowercase", () => {
    expect(slugifySegment("JYLLAND")).toBe("jylland");
  });

  it("erstatter mellemrum med bindestreg", () => {
    expect(slugifySegment("Nordjylland")).toBe("nordjylland");
    expect(slugifySegment("Nord Jylland")).toBe("nord-jylland");
  });

  it("erstatter danske bogstaver (URL-venlige ae, oe, aa)", () => {
    expect(slugifySegment("Sjælland")).toBe("sjaelland");
    expect(slugifySegment("København")).toBe("koebenhavn");
    expect(slugifySegment("Århus")).toBe("aarhus");
    expect(slugifySegment("Nykøbing Mors")).toBe("nykoebing-mors");
  });

  it("fjerner andre specialtegn", () => {
    expect(slugifySegment("Test!@#")).toBe("test");
  });
});

describe("segmentSlugToName", () => {
  const regions = ["Jylland", "Sjælland", "Fyn"];

  it("finder navn fra slug", () => {
    expect(segmentSlugToName("jylland", regions)).toBe("Jylland");
    expect(segmentSlugToName("sjaelland", regions)).toBe("Sjælland");
  });

  it("returnerer null for ukendt slug", () => {
    expect(segmentSlugToName("unknown", regions)).toBe(null);
  });

  it("accepterer ældre slug-form (ø→o, å→a) så gamle links virker", () => {
    const withDanish = ["Nykøbing Mors", "København"];
    expect(segmentSlugToName("nykoebing-mors", withDanish)).toBe("Nykøbing Mors");
    expect(segmentSlugToName("nykobing-mors", withDanish)).toBe("Nykøbing Mors");
  });
});
