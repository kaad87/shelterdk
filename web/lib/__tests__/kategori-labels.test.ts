import { describe, it, expect } from "vitest";
import {
  KATEGORI_LABELS,
  KATEGORI_GUIDE,
  kategoriLabel,
  kodeKategorier,
} from "../kategori-labels";

describe("KATEGORI_LABELS", () => {
  it("har en etiket til hver kategori koden selv kan tildele", () => {
    // Det her er vagten. Da tabellen laa inde i /tilbud, manglede 17 af de 41
    // kategorier en etiket og blev vist som deres slug. Tilfoejer nogen en ny
    // navneregel uden etiket, fejler testen her i stedet for at slippe ud.
    const uden = kodeKategorier().filter((k) => !KATEGORI_LABELS[k]);
    expect(uden).toEqual([]);
  });

  it("viser aldrig en slug som etiket", () => {
    for (const [slug, label] of Object.entries(KATEGORI_LABELS)) {
      expect(label).not.toBe(slug);
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });

  it("falder tilbage til sluggen for en ukendt kategori", () => {
    expect(kategoriLabel("findes-ikke")).toBe("findes-ikke");
    expect(kategoriLabel("sovepose")).toBe("Soveposer");
  });
});

describe("KATEGORI_GUIDE", () => {
  it("peger kun paa kategorier der har en etiket", () => {
    const ukendte = Object.keys(KATEGORI_GUIDE).filter((k) => !KATEGORI_LABELS[k]);
    expect(ukendte).toEqual([]);
  });

  it("krydslinker alle kodens kategorier paa naer baaludstyr", () => {
    // baaludstyr staar bevidst udenfor: der er ingen baal-guide endnu. Faar
    // den en, skal den tilfoejes her, og saa fejler denne test foerst.
    const uden = kodeKategorier().filter((k) => !KATEGORI_GUIDE[k]);
    expect(uden).toEqual(["baaludstyr"]);
  });

  it("har en guide-slug og en boejning der passer i saetningen", () => {
    for (const [kategori, g] of Object.entries(KATEGORI_GUIDE)) {
      expect(g.slug, kategori).toMatch(/^[a-z0-9-]+$/);
      expect(g.label, kategori).toBe(g.label.toLowerCase());
      expect(g.label.length, kategori).toBeGreaterThan(2);
    }
  });
});
