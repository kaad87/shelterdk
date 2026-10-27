import { describe, it, expect } from "vitest";
import {
  aegteRabat,
  blackFridayDato,
  blackFridayStatus,
  dageTil,
  rabatPct,
  vaelgKampagneTilbud,
  fordelGaver,
  GAVE_TRIN,
  type Gaveforslag,
} from "../kampagne";
import type { AffiliateProduct } from "../affiliate-products";

function vare(p: Partial<AffiliateProduct> & { id: string }): AffiliateProduct {
  return {
    id: p.id,
    retailer: p.retailer ?? "outmore",
    brand: p.brand ?? null,
    product_name: p.product_name ?? `Vare ${p.id}`,
    description: null,
    category_mapped: p.category_mapped ?? "sovepose",
    price: p.price ?? 500,
    price_original: p.price_original ?? null,
    discount_pct: p.discount_pct ?? null,
    in_stock: p.in_stock ?? true,
    stock_count: null,
    image_url: "",
    affiliate_url: "https://example.test",
    is_blocked: p.is_blocked ?? false,
    shipping_cost: null,
  };
}

describe("aegteRabat", () => {
  it("kraever en foer-pris der er hoejere end nu-prisen", () => {
    expect(aegteRabat({ price: 400, price_original: 800 })).toBe(true);
    expect(aegteRabat({ price: 400, price_original: 400 })).toBe(false);
    expect(aegteRabat({ price: 400, price_original: null })).toBe(false);
    expect(aegteRabat({ price: 400, price_original: 300 })).toBe(false);
  });

  it("tror ikke paa feedets discount_pct alene", () => {
    // ca. 97 % af feedet sender listeprisen i begge felter. En vare med
    // "40 % rabat" og samme pris i begge felter er ikke sat ned.
    const falsk = vare({ id: "a", price: 500, price_original: 500, discount_pct: 40 });
    expect(aegteRabat(falsk)).toBe(false);
    expect(rabatPct(falsk)).toBe(0);
  });

  it("regner rabatten af de to priser", () => {
    expect(rabatPct({ price: 500, price_original: 1000 })).toBe(50);
    expect(rabatPct({ price: 750, price_original: 1000 })).toBe(25);
  });
});

describe("vaelgKampagneTilbud", () => {
  const udvalg = [
    vare({ id: "1", category_mapped: "sovepose", price: 500, price_original: 1000 }), // 50
    vare({ id: "2", category_mapped: "sovepose", price: 600, price_original: 1000 }), // 40
    vare({ id: "3", category_mapped: "sovepose", price: 700, price_original: 1000 }), // 30
    vare({ id: "4", category_mapped: "sovepose", price: 800, price_original: 1000 }), // 20
    vare({ id: "5", category_mapped: "telt", price: 900, price_original: 1000 }), // 10
    vare({ id: "6", category_mapped: "telt", price: 1000, price_original: 1000 }), // 0
  ];

  it("tager stoerste rabat foerst", () => {
    const r = vaelgKampagneTilbud(udvalg, { maalAntal: 3, maxPrKategori: 9 });
    expect(r.varer.map((v) => v.id)).toEqual(["1", "2", "3"]);
  });

  it("lader ikke én kategori fylde hele siden", () => {
    const r = vaelgKampagneTilbud(udvalg, { maalAntal: 4, maxPrKategori: 2 });
    expect(r.varer.map((v) => v.id)).toEqual(["1", "2", "5"]);
  });

  it("oplyser den laveste rabat i det valgte udvalg", () => {
    // Siden siger tallet hoejt, saa det skal vaere det faktiske minimum og
    // ikke en graense, vi har valgt paa forhaand.
    expect(vaelgKampagneTilbud(udvalg, { maalAntal: 3, maxPrKategori: 9 }).minRabat).toBe(30);
    expect(vaelgKampagneTilbud(udvalg, { maalAntal: 2, maxPrKategori: 9 }).minRabat).toBe(40);
  });

  it("tager varer uden aegte prisfald helt ud", () => {
    const r = vaelgKampagneTilbud(udvalg, { maalAntal: 99, maxPrKategori: 99 });
    expect(r.varer.map((v) => v.id)).not.toContain("6");
    expect(r.kandidater).toBe(5);
  });

  it("giver 0 i minRabat paa en tom liste frem for at kaste", () => {
    const r = vaelgKampagneTilbud([], { maalAntal: 10, maxPrKategori: 2 });
    expect(r).toEqual({ varer: [], minRabat: 0, kandidater: 0 });
  });
});

describe("fordelGaver", () => {
  function gave(id: string, pris: number, guide: string, score: number): Gaveforslag {
    return {
      product: vare({ id, price: pris }),
      guideSlug: guide,
      guideTitle: `Bedste ${guide}`,
      award: null,
      score,
      bestFor: null,
    };
  }

  const kandidater = [
    gave("a", 150, "kniv", 9.2),
    gave("b", 180, "kniv", 9.0),
    gave("c", 190, "kniv", 8.9),
    gave("d", 120, "hue", 8.5),
    gave("e", 160, "sovepude", 8.0),
    gave("f", 350, "pandelampe", 9.1),
    gave("g", 420, "vandfilter", 9.0),
    gave("h", 800, "haengekoje", 8.9),
  ];

  it("viser kun ét forslag pr. guide pr. trin", () => {
    const r = fordelGaver(kandidater, GAVE_TRIN, 9);
    const under200 = r[0].forslag;
    expect(under200.map((g) => g.guideSlug)).toEqual(["kniv", "hue", "sovepude"]);
    // b og c er de to andre knive og maa ikke staa der.
    expect(under200.map((g) => g.product.id)).not.toContain("b");
    expect(under200.map((g) => g.product.id)).not.toContain("c");
  });

  it("tager den hoejest scorede vare fra hver guide", () => {
    const r = fordelGaver(kandidater, GAVE_TRIN, 9);
    expect(r[0].forslag[0].product.id).toBe("a");
  });

  it("lader ingen vare staa i to trin", () => {
    const r = fordelGaver(kandidater, GAVE_TRIN, 9);
    const ids = r.flatMap((t) => t.forslag.map((g) => g.product.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respekterer prisbaandene i begge ender", () => {
    const r = fordelGaver(kandidater, GAVE_TRIN, 9);
    for (const { trin, forslag } of r) {
      for (const g of forslag) {
        expect(g.product.price).toBeGreaterThanOrEqual(trin.fra);
        expect(g.product.price).toBeLessThan(trin.til);
      }
    }
  });

  it("holder sig til loftet pr. trin", () => {
    const r = fordelGaver(kandidater, GAVE_TRIN, 2);
    expect(r[0].forslag).toHaveLength(2);
  });

  it("giver tre tomme trin frem for at kaste paa ingen kandidater", () => {
    const r = fordelGaver([], GAVE_TRIN, 9);
    expect(r).toHaveLength(3);
    expect(r.every((t) => t.forslag.length === 0)).toBe(true);
  });
});

describe("blackFridayDato", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it("rammer dagen efter den fjerde torsdag i november", () => {
    expect(iso(blackFridayDato(2026))).toBe("2026-11-27");
    expect(iso(blackFridayDato(2025))).toBe("2025-11-28");
    expect(iso(blackFridayDato(2024))).toBe("2024-11-29");
    expect(iso(blackFridayDato(2027))).toBe("2027-11-26");
  });

  it("rammer altid en fredag", () => {
    for (let aar = 2024; aar <= 2040; aar++) {
      expect(blackFridayDato(aar).getUTCDay(), String(aar)).toBe(5);
    }
  });

  it("falder altid i vinduet 23. til 29. november", () => {
    for (let aar = 2024; aar <= 2040; aar++) {
      const d = blackFridayDato(aar).getUTCDate();
      expect(d, String(aar)).toBeGreaterThanOrEqual(23);
      expect(d, String(aar)).toBeLessThanOrEqual(29);
    }
  });
});

describe("dageTil", () => {
  it("tæller hele dage og ikke timer", () => {
    const sent = new Date("2026-11-20T23:30:00Z");
    expect(dageTil(new Date("2026-11-27T00:00:00Z"), sent)).toBe(7);
  });

  it("giver negativt tal naar dagen er passeret", () => {
    expect(dageTil(new Date("2026-11-27T00:00:00Z"), new Date("2026-11-30T12:00:00Z"))).toBe(-3);
  });
});

describe("blackFridayStatus", () => {
  it("tæller ned til dagen i aar", () => {
    const s = blackFridayStatus(new Date("2026-10-27T08:00:00Z"));
    expect(s.aar).toBe(2026);
    expect(s.dage).toBe(31);
    expect(s.erIGang).toBe(false);
  });

  it("er i gang fra fredag til Cyber Monday", () => {
    for (const dag of ["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"]) {
      expect(blackFridayStatus(new Date(`${dag}T12:00:00Z`)).erIGang, dag).toBe(true);
    }
  });

  it("peger paa naeste aar fra tirsdagen efter", () => {
    // Ellers ville siden staa hele december og sige "0 dage" om en dag,
    // der var overstaaet.
    const s = blackFridayStatus(new Date("2026-12-01T12:00:00Z"));
    expect(s.aar).toBe(2027);
    expect(s.erIGang).toBe(false);
    expect(s.dage).toBeGreaterThan(300);
  });

  it("siger aldrig et negativt antal dage uden at vaere i gang", () => {
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const s = blackFridayStatus(d);
      if (!s.erIGang) expect(s.dage, d.toISOString()).toBeGreaterThan(0);
    }
  });
});

describe("GAVE_TRIN", () => {
  it("er sammenhaengende baand uden huller og uden overlap", () => {
    for (let i = 1; i < GAVE_TRIN.length; i++) {
      expect(GAVE_TRIN[i].fra).toBe(GAVE_TRIN[i - 1].til);
    }
  });
});
