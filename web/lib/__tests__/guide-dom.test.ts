import { describe, expect, it } from "vitest";
import { emneFraTitel, guideDom, domSomTekst } from "@/lib/guide-dom";

const vare = (navn: string, pris: number, lager = true) => ({
  id: navn, product_name: navn, price: pris, in_stock: lager, is_blocked: false,
  retailer: "backpackerlife", brand: null, description: null, category_mapped: null,
  price_original: null, discount_pct: null, stock_count: null, image_url: "", affiliate_url: "",
  shipping_cost: null, updated_at: null, last_seen_at: null, specs: null,
});
const entry = (rank: number, award: string | null, score: number | null, bedst: string | null, navn: string, pris: number, lager = true) =>
  ({ id: `e${rank}`, rank, award_label: award, score, best_for: bedst,
     editorial_note: null, pros: null, cons: null, product: vare(navn, pris, lager) }) as never;

describe("emneFraTitel", () => {
  it("fjerner Bedste og aarstallet", () => {
    expect(emneFraTitel("Bedste campingstol 2026")).toBe("campingstol");
    expect(emneFraTitel("Bedste sovepose til vinter 2026")).toBe("sovepose til vinter");
    expect(emneFraTitel("Bedste økser og save 2026")).toBe("økser og save");
    expect(emneFraTitel("Bedste tændstål & optænding 2026")).toBe("tændstål & optænding");
  });

  it("laader forkortelser staa med stort", () => {
    expect(emneFraTitel("Bedste GPS til vandring 2026")).toBe("GPS til vandring");
  });
});

describe("guideDom", () => {
  const entries = [
    entry(0, "Bedste komfort", 8.1, "Lange aftener", "Stol - High-back UL", 599),
    entry(1, "Vores valg", 8.7, "shelterturen hvor stolen skal bæres", "Stol - Low-back UL", 449),
    entry(2, "Bedst til prisen", 8.0, "Bilen", "Festivalstol", 149),
  ];

  it("bygger dommen om varen med topprædikat, ikke den foerste", () => {
    const d = guideDom({ title: "Bedste campingstol 2026" }, entries);
    expect(d?.overskrift).toBe("ShelterDKs førstevalg til campingstol");
    expect(d?.produkt).toBe("Stol - Low-back UL");
    expect(d?.pris).toBe("449 kr.");
    expect(d?.score).toBe("8,7 af 10");
    expect(d?.begrundelse).toBe("Shelterturen hvor stolen skal bæres");
  });

  it("regner rammen paa de koebbare varer", () => {
    const d = guideDom({ title: "Bedste campingstol 2026" }, entries);
    expect(d?.ramme).toBe("Guiden sammenligner 3 produkter fra 149 kr. til 599 kr.");
  });

  it("udelader den udsolgte fra rammen", () => {
    const med = [...entries, entry(3, null, 7.0, null, "Udsolgt stol", 9999, false)];
    expect(guideDom({ title: "Bedste campingstol 2026" }, med)?.ramme)
      .toBe("Guiden sammenligner 3 produkter fra 149 kr. til 599 kr.");
  });

  it("paastaar intet foerstevalg, naar siden ikke kan vise ét", () => {
    // Alle paa lager har et praedikat, saa resolveAwards udpeger ingen. En
    // paastand siden modsiger er vaerre end ingen paastand.
    const d = guideDom({ title: "Bedste tændstål 2026" }, [
      entry(0, "Vores valg", 9.0, "x", "Udsolgt", 100, false),
      entry(1, "Bedst til prisen", 8.2, "y", "Levende A", 49),
      entry(2, "Bedste robuste", 8.4, "z", "Levende B", 79),
    ]);
    expect(d?.produkt).toBeNull();
    expect(d?.overskrift).toBe("ShelterDK om tændstål");
    expect(d?.ramme).toBe("Guiden sammenligner 2 produkter fra 49 kr. til 79 kr.");
  });

  it("giver null naar intet kan koebes", () => {
    expect(guideDom({ title: "Bedste telt 2026" }, [entry(0, "Vores valg", 9.0, "x", "Udsolgt", 100, false)])).toBeNull();
  });
});

describe("domSomTekst", () => {
  it("samler dommen til én citérbar linje", () => {
    const d = guideDom({ title: "Bedste campingstol 2026" }, [
      entry(0, "Vores valg", 8.7, "shelterturen hvor stolen skal bæres", "Stol - Low-back UL", 449),
      entry(1, "Bedst til prisen", 8.0, "Bilen", "Festivalstol", 149),
    ]);
    expect(domSomTekst(d)).toBe(
      "ShelterDKs førstevalg til campingstol: Stol - Low-back UL, 449 kr., 8,7 af 10. " +
      "Shelterturen hvor stolen skal bæres. Guiden sammenligner 2 produkter fra 149 kr. til 449 kr."
    );
  });

  it("giver null uden et foerstevalg", () => {
    expect(domSomTekst(null)).toBeNull();
  });
});
