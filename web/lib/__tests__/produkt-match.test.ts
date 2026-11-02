import { describe, expect, it } from "vitest";
import { matchNoegle, modelOrd, samlTilbud, type MatchVare } from "../produkt-match";

// Alle navne herunder staar ordret i kataloget 1. november 2026. En matcher
// skal maales mod det butikkerne faktisk skriver, for det er uenigheden
// mellem deres stavemaader der er hele opgaven.

const vare = (o: Partial<MatchVare> & { product_name: string }): MatchVare => ({
  id: o.id ?? o.product_name,
  retailer: o.retailer ?? "outmore",
  brand: o.brand ?? null,
  category_mapped: o.category_mapped ?? "kogeudstyr",
  price: o.price ?? 100,
  affiliate_url: o.affiliate_url ?? `https://shop/${o.id ?? o.product_name}`,
  in_stock: o.in_stock ?? true,
  is_blocked: o.is_blocked ?? false,
  ...o,
});

describe("modelOrd", () => {
  it("skriver de danske bogstaver ud i stedet for at dele ordet", () => {
    // NFD rører ikke ø, saa et raat [^a-z0-9]-filter gav "stormk" og "kken".
    expect(modelOrd(vare({ product_name: "Stormkøkken - Trangia Micro Original", brand: "Trangia" }))).toEqual(
      ["micro", "original", "stormkoekken"]
    );
  });

  it("fjerner koen, saa Mens og Men bliver det samme", () => {
    const a = vare({ product_name: "Keen Mens Arroyo II", brand: "Keen" });
    const b = vare({ product_name: "Keen Arroyo II Men", brand: "Keen" });
    expect(modelOrd(a)).toEqual(modelOrd(b));
    expect(modelOrd(a)).toEqual(["arroyo", "ii"]);
  });

  it("fjerner maerket, ogsaa naar butikken skriver det bagerst", () => {
    expect(
      modelOrd(vare({ product_name: "Camp Cutlery Spork - Charcoal - Sea to summit", brand: null }))
    ).toEqual(["camp", "cutlery", "spork"]);
  });

  it("fjerner stoerrelsen og ordet der annoncerer den", () => {
    expect(
      modelOrd(vare({ product_name: "Carinthia G-loft Isg 2.0 Jacket - Black - Str. XXL", brand: "Carinthia" }))
    ).toEqual(["2p0", "g", "isg", "jacket", "loft"]);
  });

  it("beholder maal, fordi en 20-liters saek ikke er en 8-liters", () => {
    const stor = modelOrd(vare({ product_name: "Dry bag - Sea to Summit Big River - 20 liter", brand: null }));
    const lille = modelOrd(vare({ product_name: "Dry bag - Sea to Summit Big River - 8 liter", brand: null }));
    expect(stor).not.toEqual(lille);
    expect(stor).toContain("20");
  });

  it("beholder et modelnummer, saa Defence 1 ikke bliver Defence 4", () => {
    const et = modelOrd(vare({ product_name: "Carinthia Defence 1 Top", brand: "Carinthia" }));
    const fire = modelOrd(vare({ product_name: "Carinthia Defence 4", brand: "Carinthia" }));
    expect(et).not.toEqual(fire);
  });
});

describe("matchNoegle", () => {
  it("giver samme noegle paa tvaers af butikkernes stavemaade", () => {
    const a = vare({
      product_name: "Fjällräven Vidda Pro Lite Zip-Off Trousers Men",
      brand: "Fjällräven",
      category_mapped: "vandrebukser",
      retailer: "outdoornu",
    });
    const b = vare({
      product_name: "Fjällräven Vidda Pro Lite Zip-off Trousers Mens",
      brand: "Fjällräven",
      category_mapped: "vandrebukser",
      retailer: "prooutdoor",
    });
    expect(matchNoegle(a)).toBe(matchNoegle(b));
  });

  it("skiller en model fra sit hoejere trin", () => {
    // Delmaengde-match flettede teltet med "Telos Tr3 Plus" til 5.520 kr.
    const tr3 = vare({ product_name: "Sea To Summit Telos Tr3", brand: "Sea to Summit", category_mapped: "telt" });
    const plus = vare({
      product_name: "Sea To Summit Telos Tr3 Plus",
      brand: "Sea to Summit",
      category_mapped: "telt",
    });
    expect(matchNoegle(tr3)).not.toBe(matchNoegle(plus));
  });

  it("skiller tilbehoeret fra selve varen", () => {
    // "Telos Tr3 Bigfoot Footprint" til 668 kr. blev flettet med teltet til
    // 4.840 kr., fordi et footprint laa i samme kategori og samme maerke.
    const telt = vare({ product_name: "Sea To Summit Telos Tr3", brand: "Sea to Summit", category_mapped: "telt" });
    const gulv = vare({
      product_name: "Sea To Summit Telos Tr3 Bigfoot Footprint",
      brand: "Sea to Summit",
      category_mapped: "telt",
    });
    expect(matchNoegle(telt)).not.toBe(matchNoegle(gulv));
  });

  it("skiller to maerker med samme modelord", () => {
    const fjall = vare({
      product_name: "Fjällräven Reversible Bucket Hat",
      brand: "Fjällräven",
      category_mapped: "solhat",
    });
    const tnf = vare({
      product_name: "The North Face Class V Reversible Bucket Hat",
      brand: "The North Face",
      category_mapped: "solhat",
    });
    expect(matchNoegle(fjall)).not.toBe(matchNoegle(tnf));
  });

  it("giver null naar der ikke er nok til at vaere sikker", () => {
    expect(matchNoegle(vare({ product_name: "Dry bag - 8 liter", brand: null }))).toBeNull();
    expect(
      matchNoegle(vare({ product_name: "Keen Mens Arroyo II", brand: "Keen", category_mapped: null }))
    ).toBeNull();
  });
});

describe("samlTilbud", () => {
  const katalog: MatchVare[] = [
    vare({
      id: "prooutdoor-arroyo",
      retailer: "prooutdoor",
      product_name: "Keen Mens Arroyo II",
      brand: "Keen",
      category_mapped: "vandresandal",
      price: 959.95,
    }),
    vare({
      id: "outdoornu-arroyo-45",
      retailer: "outdoornu",
      product_name: "Keen Arroyo II Men",
      brand: "Keen",
      category_mapped: "vandresandal",
      price: 850,
    }),
    vare({
      id: "outdoornu-arroyo-46",
      retailer: "outdoornu",
      product_name: "Keen Arroyo II Men",
      brand: "Keen",
      category_mapped: "vandresandal",
      price: 899,
    }),
    vare({
      id: "prooutdoor-teva",
      retailer: "prooutdoor",
      product_name: "Teva Terra Fi Lite Herre",
      brand: "Teva",
      category_mapped: "vandresandal",
      price: 719.95,
    }),
  ];

  it("samler butikkerne billigst foerst", () => {
    const t = samlTilbud(katalog[0], katalog);
    expect(t.map((x) => x.retailer)).toEqual(["outdoornu", "prooutdoor"]);
    expect(t[0].price).toBe(850);
  });

  it("viser én pris pr. butik, ikke én pr. stoerrelse", () => {
    // Outdoornu har en raekke pr. stoerrelse. Uden sammenlaegning stod samme
    // sko tre gange i tabellen.
    const t = samlTilbud(katalog[0], katalog);
    expect(t).toHaveLength(2);
    expect(t.find((x) => x.retailer === "outdoornu")?.varianter).toBe(2);
  });

  it("tager ikke en anden model med", () => {
    const t = samlTilbud(katalog[0], katalog);
    expect(t.some((x) => x.id === "prooutdoor-teva")).toBe(false);
  });

  it("springer udsolgte og blokerede over", () => {
    const medUdsolgt = katalog.map((v) =>
      v.id === "outdoornu-arroyo-45" ? { ...v, in_stock: false } : v
    );
    const t = samlTilbud(medUdsolgt[0], medUdsolgt);
    expect(t.find((x) => x.retailer === "outdoornu")?.price).toBe(899);
  });

  it("viser varen alene, naar den ikke kan matches", () => {
    const uden = vare({
      id: "backpackerlife-drybag",
      retailer: "backpackerlife",
      product_name: "Dry bag - 8 liter",
      brand: null,
      category_mapped: "pakposer",
      price: 79,
    });
    const t = samlTilbud(uden, [...katalog, uden]);
    expect(t).toHaveLength(1);
    expect(t[0].retailer).toBe("backpackerlife");
  });

  it("har varen med, ogsaa naar den selv er udsolgt", () => {
    // Det er den side vi staar paa. Den maa ikke forsvinde fra sin egen tabel.
    const udsolgt = { ...katalog[0], in_stock: false };
    const t = samlTilbud(udsolgt, [udsolgt, ...katalog.slice(1)]);
    expect(t.some((x) => x.retailer === "prooutdoor")).toBe(true);
  });
});
