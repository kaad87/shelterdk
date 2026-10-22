import { describe, expect, it } from "vitest";
import { POSTBY_SYNONYMER } from "@/lib/generated/postby-synonymer";
import { SEARCH_SYNONYMS } from "@/lib/search-synonyms";

describe("postby-synonymer", () => {
  it("kender Hurup, som er grunden til at tabellen findes", () => {
    // Der ligger nul shelters i Hurup, men 48 inden for 25 km, det naermeste
    // 4,5 km vaek. Uden tabellen gav soegningen nul traeffere.
    expect(POSTBY_SYNONYMER["hurup"]).toBeDefined();
    expect(POSTBY_SYNONYMER["hurup"]).toContain("Ydby");
  });

  it("indekserer baade den fulde og den korte form", () => {
    // Postbyen hedder "Hurup Thy", men ingen skriver det.
    expect(POSTBY_SYNONYMER["hurup thy"]).toEqual(POSTBY_SYNONYMER["hurup"]);
  });

  it("laver ikke et alias for en tvetydig kort form", () => {
    // Tre byer hedder Nykoebing. Et alias ville pege paa én og tie om de to.
    expect(POSTBY_SYNONYMER["nykoebing"]).toBeUndefined();
  });

  it("overlapper ikke med landsdels-synonymerne", () => {
    // De to tabeller bruges forskelligt: SEARCH_SYNONYMS som kommune.eq,
    // denne som place.eq. En noegle i begge ville give dobbelt match.
    const fælles = Object.keys(POSTBY_SYNONYMER)
      .filter((k) => k in SEARCH_SYNONYMS);
    expect(fælles).toEqual([]);
  });

  it("har en overkommelig liste pr. by", () => {
    // Flere end 25 bliver stoej i en resultatliste, og de fjerneste er
    // mindst relevante.
    for (const [by, naboer] of Object.entries(POSTBY_SYNONYMER)) {
      expect(naboer.length, by).toBeGreaterThan(0);
      expect(naboer.length, by).toBeLessThanOrEqual(25);
      expect(new Set(naboer).size, `${by} har dubletter`).toBe(naboer.length);
    }
  });

  it("bruger normaliserede noegler, saa oe/ae/aa rammer", () => {
    for (const k of Object.keys(POSTBY_SYNONYMER)) {
      expect(k, k).toBe(k.toLowerCase());
      expect(k, `${k} indeholder æøå`).not.toMatch(/[æøå]/);
    }
  });
});
