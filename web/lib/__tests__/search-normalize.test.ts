import { describe, it, expect } from "vitest";
import {
  normalizeDanish,
  expandDanishVariants,
  escapeIlikePattern,
} from "../search-normalize";

describe("normalizeDanish", () => {
  it("converts æøå to ae/oe/aa", () => {
    expect(normalizeDanish("København")).toBe("koebenhavn");
    expect(normalizeDanish("Århus")).toBe("aarhus");
    expect(normalizeDanish("Næstved")).toBe("naestved");
    expect(normalizeDanish("Sønderborg")).toBe("soenderborg");
  });

  it("is case-insensitive", () => {
    expect(normalizeDanish("KØBENHAVN")).toBe("koebenhavn");
    expect(normalizeDanish("KøBeNhAvN")).toBe("koebenhavn");
  });

  it("handles accented vowels (é, è, ü, ö, ä)", () => {
    expect(normalizeDanish("Skagén")).toBe("skagen");
    expect(normalizeDanish("Münster")).toBe("muenster");
  });

  it("trims whitespace", () => {
    expect(normalizeDanish("  København  ")).toBe("koebenhavn");
  });
});

describe("expandDanishVariants", () => {
  it("expands ae/oe/aa to æøå (and back)", () => {
    const variants = expandDanishVariants("kobenhavn");
    expect(variants).toContain("kobenhavn");
    // The string already has no æøå, so the ae/oe/aa → æøå transform
    // produces "kobenhavn" unchanged (no "ae", "oe", or "aa" substring).
    // What we DO want: the user types kobenhavn → we accept the input AND
    // generate "koebenhavn"-style if they had typed it differently.
    // Check the practical case: user typed "Koebenhavn"
    const v2 = expandDanishVariants("koebenhavn");
    expect(v2).toContain("koebenhavn");
    expect(v2).toContain("københavn");
  });

  it("expands København to ASCII variant", () => {
    const variants = expandDanishVariants("København");
    expect(variants).toContain("københavn");
    expect(variants).toContain("koebenhavn");
  });

  it("handles Aarhus ↔ Århus duality", () => {
    const v1 = expandDanishVariants("aarhus");
    expect(v1).toContain("aarhus");
    expect(v1).toContain("århus");

    const v2 = expandDanishVariants("Århus");
    expect(v2).toContain("århus");
    expect(v2).toContain("aarhus");
  });

  it("handles Aalborg ↔ Ålborg", () => {
    const variants = expandDanishVariants("aalborg");
    expect(variants).toContain("aalborg");
    expect(variants).toContain("ålborg");
  });

  it("returns empty array for empty input", () => {
    expect(expandDanishVariants("")).toEqual([]);
    expect(expandDanishVariants("   ")).toEqual([]);
  });

  it("returns single variant when nothing to expand", () => {
    const variants = expandDanishVariants("bornholm");
    expect(variants).toEqual(["bornholm"]);
  });

  it("caps expansion to avoid query bloat", () => {
    const variants = expandDanishVariants("ægæøæåæöä");
    expect(variants.length).toBeLessThanOrEqual(6);
  });
});

describe("escapeIlikePattern", () => {
  it("escapes % and _", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
    expect(escapeIlikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes backslashes", () => {
    expect(escapeIlikePattern("a\\b")).toBe("a\\\\b");
  });

  it("leaves normal text untouched", () => {
    expect(escapeIlikePattern("København")).toBe("København");
    expect(escapeIlikePattern("Aarhus")).toBe("Aarhus");
  });
});
