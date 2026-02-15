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

  it("erstatter danske bogstaver", () => {
    expect(slugifySegment("Sjælland")).toBe("sjaelland");
    expect(slugifySegment("København")).toBe("kobenhavn");
    expect(slugifySegment("Århus")).toBe("arhus"); // å→a (ikke aa)
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
});
