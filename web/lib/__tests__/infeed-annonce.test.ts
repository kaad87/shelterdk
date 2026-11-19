import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/utils/supabase/server-public", () => ({
  createPublicClient: () => ({ from: () => ({ select }) }),
}));

// Prisfaldene slaas op i lib/prisfald-opslag. Uden en mock ville hver test
// her forsoege at naa Supabase. `fald` styrer svaret pr. test.
let fald: Map<string, { foer: number; nu: number; pct: number; siden: string }> | Error = new Map();
const hentPrisfald = vi.fn(async () => {
  if (fald instanceof Error) throw fald;
  return fald;
});
vi.mock("@/lib/prisfald-opslag", () => ({ hentPrisfald: (...a: unknown[]) => hentPrisfald(...(a as [])) }));

import {
  IN_FEED_ARME,
  _nulstilInFeedCache,
  harRabat,
  hentGuideVarer,
  hentInFeedAnnonce,
  stiHash,
  armForTime,
  vaelgArm,
  vaelgVare,
  vaelgVarer,
  type InFeedArm,
} from "@/lib/infeed-annonce";
import type { GuideKandidat } from "@/lib/guide-links";

function produkt(over: Record<string, unknown> = {}) {
  return {
    id: "backpackerlife-1",
    product_name: "Sovepose - Treklife Hyper 4S -9",
    brand: null,
    display_name: null,
    display_brand: null,
    price: 899,
    price_original: null,
    discount_pct: null,
    image_url: "https://example.test/a.png",
    affiliate_url: "https://example.test/go",
    in_stock: true,
    is_blocked: false,
    ...over,
  };
}

function svar(raekker: unknown[]) {
  select.mockReturnValue({ eq: () => Promise.resolve({ data: raekker, error: null }) });
}

beforeEach(() => {
  _nulstilInFeedCache();
  select.mockReset();
  hentPrisfald.mockClear();
  fald = new Map();
});

describe("vaelgArm", () => {
  it("giver samme arm for samme sti, saa ISR-cachen ikke fryser et tilfaeldigt valg", () => {
    const a = vaelgArm("/shelter-med-baalplads");
    for (let i = 0; i < 20; i++) expect(vaelgArm("/shelter-med-baalplads")).toBe(a);
  });

  it("ignorerer query og afsluttende skraastreg, saa samme side ikke splittes i to arme", () => {
    const a = vaelgArm("/by/koebenhavn");
    expect(vaelgArm("/by/koebenhavn/")).toBe(a);
    expect(vaelgArm("/by/koebenhavn?side=2")).toBe(a);
  });

  it("rammer alle fire arme over sitets egne stier", () => {
    const stier = [
      "/shelter-med-baalplads", "/shelter-med-vand", "/shelter-naer-vand", "/shelter-med-hund",
      "/shelter-til-familier", "/shelter-til-cykeltur", "/fri-teltning", "/teltplads",
      "/baalhytte", "/haervejen", "/gudenaaen", "/shelter-med-toilet", "/shelter-med-bruser",
      "/shelter-med-strand", "/handicapvenlige-shelters", "/omraade/bornholm", "/by/koebenhavn",
      "/by/aarhus", "/by/odense", "/by/aalborg", "/danmark/fyn", "/danmark/sjaelland",
      "/danmark/jylland/vejle", "/danmark/fyn/odense", "/soeg", "/nye", "/arla-oeko-shelter",
    ];
    const set = new Set(stier.map(vaelgArm));
    expect(set.size, [...set].join(",")).toBe(IN_FEED_ARME.length);
  });

  // En skaev fordeling ville ikke fejle noget, men ville goere forsoeget
  // langsommere uden at nogen opdagede det. 2.000 syntetiske by-stier er
  // taet nok paa sitets 955 by-sider til at fange et daarligt hash.
  it("fordeler nogenlunde jaevnt over mange stier", () => {
    const antal: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const arm = vaelgArm(`/by/by-nummer-${i}`);
      antal[arm] = (antal[arm] ?? 0) + 1;
    }
    for (const arm of IN_FEED_ARME) {
      expect(antal[arm] ?? 0, `${arm}: ${JSON.stringify(antal)}`).toBeGreaterThan(2000 / 4 * 0.75);
    }
  });

  it("stiHash er stabil og uden fortegn", () => {
    expect(stiHash("/a")).toBe(stiHash("/a"));
    expect(stiHash("/a")).toBeGreaterThanOrEqual(0);
    expect(stiHash("/a")).not.toBe(stiHash("/b"));
  });
});

describe("harRabat", () => {
  it("kraever at foerprisen er hoejere end prisen", () => {
    expect(harRabat({ pris: 100, foerPris: 150 })).toBe(true);
    expect(harRabat({ pris: 100, foerPris: 100 })).toBe(false);
    expect(harRabat({ pris: 100, foerPris: 80 })).toBe(false);
    expect(harRabat({ pris: 100, foerPris: null })).toBe(false);
  });
});

describe("hentGuideVarer", () => {
  it("springer varer over der ikke kan koebes", async () => {
    svar([
      { slug: "sovepose", buying_guide_entries: [
        { rank: 0, affiliate_products: produkt({ id: "udsolgt", in_stock: false }) },
        { rank: 1, affiliate_products: produkt({ id: "blokeret", is_blocked: true }) },
        { rank: 2, affiliate_products: produkt({ id: "uden-url", affiliate_url: null }) },
        { rank: 3, affiliate_products: produkt({ id: "uden-billede", image_url: null }) },
        { rank: 4, affiliate_products: produkt({ id: "god" }) },
      ] },
    ]);
    const m = await hentGuideVarer();
    expect(m.get("sovepose")?.map((v) => v.produktId)).toEqual(["god"]);
  });

  it("sorterer efter guidens egen rang, ikke efter hvad basen returnerer", async () => {
    svar([
      { slug: "sovepose", buying_guide_entries: [
        { rank: 5, affiliate_products: produkt({ id: "fem" }) },
        { rank: 0, affiliate_products: produkt({ id: "nul" }) },
        { rank: 2, affiliate_products: produkt({ id: "to" }) },
      ] },
    ]);
    const m = await hentGuideVarer();
    expect(m.get("sovepose")?.map((v) => v.produktId)).toEqual(["nul", "to", "fem"]);
  });

  it("udelader guider uden en eneste brugbar vare", async () => {
    svar([
      { slug: "tom", buying_guide_entries: [
        { rank: 0, affiliate_products: produkt({ in_stock: false }) },
      ] },
      { slug: "fuld", buying_guide_entries: [{ rank: 0, affiliate_products: produkt() }] },
    ]);
    const m = await hentGuideVarer();
    expect(m.has("tom")).toBe(false);
    expect(m.has("fuld")).toBe(true);
  });

  it("rydder op i feedets kataloglinje, saa kortet viser et produktnavn", async () => {
    svar([{ slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt() }] }]);
    const m = await hentGuideVarer();
    const v = m.get("sovepose")![0];
    expect(v.navn).not.toMatch(/^Sovepose - /);
    expect(v.navn).toContain("Hyper 4S");
  });

  it("henter kun én gang inden for TTL", async () => {
    svar([{ slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt() }] }]);
    await hentGuideVarer();
    await hentGuideVarer();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("giver et tomt kort i stedet for at kaste naar opslaget fejler", async () => {
    select.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: { message: "nede" } }) });
    await expect(hentGuideVarer()).resolves.toEqual(new Map());
  });
});

describe("vaelgVare", () => {
  const vare = (over: Record<string, unknown> = {}) => ({
    produktId: "p", rank: 0, navn: "Hyper 4S", maerke: "Treklife" as string | null,
    pris: 899, foerPris: null as number | null, rabatPct: null as number | null,
    billede: "i", url: "u", retailer: "backpackerlife",
    kategori: "sovepose" as string | null, ...over,
  });
  const guider = new Map([
    ["sovepose", [vare({ produktId: "fuldpris" })]],
    ["liggeunderlag", [
      vare({ produktId: "lille-rabat", pris: 900, foerPris: 1000, rabatPct: 10 }),
      vare({ produktId: "stor-rabat", pris: 844, foerPris: 1299, rabatPct: 35, rank: 1 }),
    ]],
  ]);
  const k = (slug: string, reason = "Fordi", when?: boolean): GuideKandidat => ({ slug, reason, when });

  it("giver ingen vare i adsense-armen", () => {
    expect(vaelgVare([k("sovepose")], guider, "adsense")).toBeNull();
  });

  it("tager guidens eget foerstevalg i armene ren og kontekst", () => {
    for (const arm of ["ren", "kontekst"] as InFeedArm[]) {
      expect(vaelgVare([k("liggeunderlag")], guider, arm)?.produktId).toBe("lille-rabat");
    }
  });

  it("tager den stoerste rabat i tilbudsarmen, ikke den hoejeste rang", () => {
    expect(vaelgVare([k("liggeunderlag")], guider, "tilbud")?.produktId).toBe("stor-rabat");
  });

  // Det vigtigste enkelttilfaelde: der fandtes 8/11-2026 nul soveposer over
  // 500 kr. med reel foerpris. Faldt tilbudsarmen tilbage til fuld pris,
  // ville den maale noget andet end sig selv.
  it("giver null i tilbudsarmen frem for at vise en vare uden rabat", () => {
    expect(vaelgVare([k("sovepose")], guider, "tilbud")).toBeNull();
  });

  it("springer kandidater over der er slaaet fra af aarstiden", () => {
    const ud = vaelgVare([k("liggeunderlag", "Vinter", false), k("sovepose")], guider, "ren");
    expect(ud?.guideSlug).toBe("sovepose");
  });

  it("springer kandidater over hvis guide ingen varer har", () => {
    expect(vaelgVare([k("findes-ikke"), k("sovepose")], guider, "ren")?.guideSlug).toBe("sovepose");
  });

  it("gaar videre til naeste kandidat naar tilbudsarmen ikke kan bruge den foerste", () => {
    const ud = vaelgVare([k("sovepose"), k("liggeunderlag")], guider, "tilbud");
    expect(ud?.produktId).toBe("stor-rabat");
  });

  it("baerer kandidatens begrundelse med, saa kontekst-armen har noget at vise", () => {
    expect(vaelgVare([k("sovepose", "Til nætter under frysepunktet")], guider, "ren")?.begrundelse)
      .toBe("Til nætter under frysepunktet");
  });
});

describe("vaelgVarer", () => {
  const vare = (produktId: string, over: Record<string, unknown> = {}) => ({
    produktId, rank: 0, navn: produktId, maerke: null as string | null,
    pris: 500, foerPris: null as number | null, rabatPct: null as number | null,
    billede: "i", url: "u", retailer: "backpackerlife", kategori: null as string | null, ...over,
  });
  const guider = new Map([
    ["sovepose", [vare("s1"), vare("s2"), vare("s3")]],
    ["vandfilter", [vare("v1"), vare("v2")]],
    ["pandelampe", [vare("p1", { foerPris: 600, rabatPct: 17 })]],
  ]);
  const k = (slug: string): GuideKandidat => ({ slug, reason: slug });

  // Forsoegets foerste version: 146 af 172 visninger var en sovepose.
  it("fordeler pladserne paa guiderne foer den tager naestbedste fra samme guide", () => {
    const ud = vaelgVarer([k("sovepose"), k("vandfilter"), k("pandelampe")], guider, "ren", 3);
    expect(ud.map((v) => v.produktId)).toEqual(["s1", "v1", "p1"]);
  });

  it("fylder op fra samme guide naar der er faerre guider end pladser", () => {
    const ud = vaelgVarer([k("sovepose"), k("vandfilter")], guider, "ren", 3);
    expect(ud.map((v) => v.produktId)).toEqual(["s1", "v1", "s2"]);
  });

  it("viser aldrig samme vare to gange, heller ikke fra to guider", () => {
    const dobbelt = new Map([["a", [vare("x"), vare("y")]], ["b", [vare("x")]]]);
    expect(vaelgVarer([k("a"), k("b")], dobbelt, "ren", 3).map((v) => v.produktId)).toEqual(["x", "y"]);
  });

  it("bruger kun nedsatte varer i tilbudsarmen, ogsaa naar det giver faerre end pladserne", () => {
    const ud = vaelgVarer([k("sovepose"), k("vandfilter"), k("pandelampe")], guider, "tilbud", 3);
    expect(ud.map((v) => v.produktId)).toEqual(["p1"]);
  });

  it("giver ingen varer i adsense-armen", () => {
    expect(vaelgVarer([k("sovepose")], guider, "adsense", 3)).toEqual([]);
  });

  it("tager kun en guide én gang, selv om den staar to gange i kandidaterne", () => {
    const ud = vaelgVarer([k("vandfilter"), k("vandfilter")], guider, "ren", 2);
    expect(ud.map((v) => v.produktId)).toEqual(["v1", "v2"]);
  });
});

describe("armForTime", () => {
  it("er stabil inden for en time og skifter til naeste time", () => {
    const t = Date.UTC(2026, 10, 19, 10, 0, 0);
    expect(armForTime(new Date(t + 59 * 60_000))).toBe(armForTime(new Date(t)));
    expect(armForTime(new Date(t + 60 * 60_000))).not.toBe(armForTime(new Date(t)));
  });

  it("rammer alle fire arme over et doegn", () => {
    const t = Date.UTC(2026, 10, 19);
    const set = new Set(Array.from({ length: 24 }, (_, h) => armForTime(new Date(t + h * 3_600_000))));
    expect(set).toEqual(new Set(IN_FEED_ARME));
  });
});

describe("hentInFeedAnnonce", () => {
  const STIER = ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h"];

  it("slaar ikke op i basen naar armen er adsense", async () => {
    const sti = STIER.find((s) => vaelgArm(s) === "adsense")!;
    const ud = await hentInFeedAnnonce(sti, [{ slug: "sovepose", reason: "x" }]);
    expect(ud.arm).toBe("adsense");
    expect(ud.varer).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it("henter varer med kandidatens begrundelse naar armen kan bruge dem", async () => {
    svar([{ slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt() }] }]);
    const sti = STIER.find((s) => vaelgArm(s) === "ren" || vaelgArm(s) === "kontekst")!;
    const ud = await hentInFeedAnnonce(sti, [{ slug: "sovepose", reason: "Til vinteren" }]);
    expect(ud.varer[0]?.begrundelse).toBe("Til vinteren");
    expect(ud.varer[0]?.guideSlug).toBe("sovepose");
  });

  // Foer gav en side uden kandidater AdSense. Nu faar den saesonens grej.
  it("bruger saesonens grej naar siden ingen egne kandidater har", async () => {
    svar([
      { slug: "sovepose-til-vinter", buying_guide_entries: [{ rank: 0, affiliate_products: produkt({ id: "vinter" }) }] },
      { slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt({ id: "sommer" }) }] },
    ]);
    const vinter = await hentInFeedAnnonce("/soeg", [], { arm: "ren", nu: new Date(Date.UTC(2026, 10, 19)) });
    expect(vinter.varer.map((v) => v.produktId)).toEqual(["vinter"]);
    _nulstilInFeedCache();
    const sommer = await hentInFeedAnnonce("/soeg", [], { arm: "ren", nu: new Date(Date.UTC(2026, 6, 1)) });
    expect(sommer.varer.map((v) => v.produktId)).toEqual(["sommer"]);
  });

  it("lader sidens egne kandidater vinde pladserne foer saesonens", async () => {
    svar([
      { slug: "vandfilter", buying_guide_entries: [{ rank: 0, affiliate_products: produkt({ id: "filter" }) }] },
      { slug: "sovepose-til-vinter", buying_guide_entries: [{ rank: 0, affiliate_products: produkt({ id: "vinter" }) }] },
    ]);
    const ud = await hentInFeedAnnonce("/x", [{ slug: "vandfilter", reason: "Ingen vand" }], {
      arm: "kontekst",
      nu: new Date(Date.UTC(2026, 10, 19)),
    });
    expect(ud.varer.map((v) => v.produktId)).toEqual(["filter", "vinter"]);
  });

  it("lader en arm-parameter gaa forud for stien", async () => {
    const ud = await hentInFeedAnnonce("/soeg", [], { arm: "adsense" });
    expect(ud.arm).toBe("adsense");
    expect(select).not.toHaveBeenCalled();
  });
});

describe("hentGuideVarer og prisfald", () => {
  it("bruger vores foer-pris, ikke feedets", async () => {
    svar([
      { slug: "sovepose", buying_guide_entries: [
        { rank: 0, affiliate_products: produkt({ id: "faldet", price: 495, price_original: 899, discount_pct: 45 }) },
        { rank: 1, affiliate_products: produkt({ id: "staaende", price: 495, price_original: 899, discount_pct: 45 }) },
      ] },
    ]);
    fald = new Map([["faldet", { foer: 739, nu: 495, pct: 33, siden: "2026-11-14" }]]);
    const [a, b] = (await hentGuideVarer()).get("sovepose")!;
    expect([a.foerPris, a.rabatPct]).toEqual([739, 33]);
    // Feedet siger 45 % paa begge. Vi har kun set den ene falde.
    expect([b.foerPris, b.rabatPct]).toEqual([null, null]);
    expect(harRabat(b)).toBe(false);
  });

  it("viser ingen rabat, naar prisfaldene ikke kan slaas op", async () => {
    svar([
      { slug: "sovepose", buying_guide_entries: [
        { rank: 0, affiliate_products: produkt({ price: 495, price_original: 899, discount_pct: 45 }) },
      ] },
    ]);
    fald = new Error("timeout");
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});
    const [v] = (await hentGuideVarer()).get("sovepose")!;
    stille.mockRestore();
    expect(v.foerPris).toBeNull();
    expect(harRabat(v)).toBe(false);
  });

  it("proever prisfaldene igen efter en fejl i stedet for at gemme den en time", async () => {
    svar([{ slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt({ id: "x", price: 495 }) }] }]);
    fald = new Error("timeout");
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});
    await hentGuideVarer();
    stille.mockRestore();
    fald = new Map([["x", { foer: 739, nu: 495, pct: 33, siden: "2026-11-14" }]]);
    const tid = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(tid + 6 * 60 * 1000);
    const [v] = (await hentGuideVarer()).get("sovepose")!;
    vi.restoreAllMocks();
    expect(v.foerPris).toBe(739);
  });
});
