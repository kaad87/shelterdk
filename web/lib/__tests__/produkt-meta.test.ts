import { describe, expect, it } from "vitest";
import { BESKRIVELSE_MAKS, samlBeskrivelse } from "../produkt-meta";

// Delene herunder er dem produktsiden faktisk bygger, med rigtige tal fra
// /grej/petzl-swift-rl 2. november 2026.
const petzl = [
  "PETZL SWIFT RL: kraftig / reaktiv.",
  "Vi giver den 8,9 af 10.",
  "Pris fra 799,95 kr.",
  null,
  null,
  "Nr. 2 af 9 i vores test.",
  "Fordel: kraftigt + reaktivt lys.",
  null,
];

describe("samlBeskrivelse", () => {
  it("fylder snippet-pladsen ud i stedet for at stoppe ved fire dele", () => {
    // Den gamle skabelon gav 77 tegn paa praecis denne vare.
    const ud = samlBeskrivelse(petzl);
    expect(ud.length).toBeGreaterThan(110);
    expect(ud).toContain("Nr. 2 af 9");
    expect(ud).toContain("Fordel:");
  });

  it("holder sig inden for maks", () => {
    const ud = samlBeskrivelse(petzl);
    expect(ud.length).toBeLessThanOrEqual(BESKRIVELSE_MAKS);
  });

  it("springer tomme og manglende dele over", () => {
    expect(samlBeskrivelse(["Navn.", null, undefined, "   ", "Score."])).toBe("Navn. Score.");
  });

  it("tager altid navnet med, ogsaa naar det alene er for langt", () => {
    // Det laengste produktnavn i kataloget maaler 80 tegn, og med
    // ": pris og vurdering." kan foerste del overstige en lav maks.
    const langt = "A".repeat(200) + ".";
    expect(samlBeskrivelse([langt, "Kort."], 50)).toBe(langt);
  });

  it("springer en for lang del over og tager en kortere laengere nede med", () => {
    // Delene er selvstaendige saetninger, saa pladsen fyldes bedre ved at
    // springe over end ved at stoppe.
    const ud = samlBeskrivelse(["Navn.", "En meget lang saetning der ikke kan vaere.", "Kort."], 20);
    expect(ud).toBe("Navn. Kort.");
  });

  it("giver tom streng naar der ikke er noget at skrive", () => {
    expect(samlBeskrivelse([])).toBe("");
    expect(samlBeskrivelse([null, undefined, ""])).toBe("");
  });

  it("saetter praecis ét mellemrum mellem delene", () => {
    expect(samlBeskrivelse([" Navn. ", " Score. "])).toBe("Navn. Score.");
  });
});
