import { describe, it, expect } from "vitest";
import { retailerNavn } from "@/lib/retailer-navn";

describe("retailerNavn", () => {
  it("giver det rigtige navn for de otte butikker der staar i publicerede guider", () => {
    // Optalt 9. november 2026 over buying_guide_entries. Alle otte skal have
    // et navn: listen i GearCardClient kendte kun tre, og de fem andre
    // rendrede "Hos  · Annonce" med tomt navn paa 68 produkter.
    expect(retailerNavn("backpackerlife")).toBe("Backpackerlife.dk");
    expect(retailerNavn("outmore")).toBe("Outmore.dk");
    expect(retailerNavn("outdoortid")).toBe("Outdoortid.dk");
    expect(retailerNavn("prooutdoor")).toBe("ProOutdoor.dk");
    expect(retailerNavn("outnorth")).toBe("Outnorth.dk");
    expect(retailerNavn("outdoornu")).toBe("OutdoorNu.dk");
    expect(retailerNavn("outdooricentrum")).toBe("OutdoorICentrum.dk");
    expect(retailerNavn("zeejuu")).toBe("Zeejuu.dk");
  });

  it("giver aldrig tom streng", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(retailerNavn(v as string | null | undefined).length).toBeGreaterThan(0);
    }
  });

  it("giver et laeseligt navn for en butik der ikke er paa listen endnu", () => {
    // Reserven er vigtigere end den ser ud: en ny butik i feedet skal ikke
    // forsvinde lydloest fra oplysningslinjen, bare fordi ingen har tilfoejet
    // den her.
    expect(retailerNavn("nyebutik")).toBe("Nyebutik");
  });

  it("er ligeglad med store bogstaver og mellemrum", () => {
    expect(retailerNavn("  Backpackerlife  ")).toBe("Backpackerlife.dk");
    expect(retailerNavn("OUTMORE")).toBe("Outmore.dk");
  });
});
