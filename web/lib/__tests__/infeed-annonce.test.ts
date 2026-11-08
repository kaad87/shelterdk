import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/utils/supabase/server-public", () => ({
  createPublicClient: () => ({ from: () => ({ select }) }),
}));

import {
  IN_FEED_ARME,
  _nulstilInFeedCache,
  harRabat,
  hentGuideVarer,
  hentInFeedAnnonce,
  stiHash,
  vaelgArm,
  vaelgVare,
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

describe("hentInFeedAnnonce", () => {
  it("slaar ikke op i basen naar armen er adsense", async () => {
    const sti = IN_FEED_ARME.length
      ? ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h"].find((s) => vaelgArm(s) === "adsense")!
      : "/a";
    const ud = await hentInFeedAnnonce(sti, [{ slug: "sovepose", reason: "x" }]);
    expect(ud.arm).toBe("adsense");
    expect(ud.vare).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("slaar ikke op naar siden ingen kandidater har", async () => {
    const sti = ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h"].find((s) => vaelgArm(s) !== "adsense")!;
    const ud = await hentInFeedAnnonce(sti, []);
    expect(ud.vare).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("henter en vare naar armen kan bruge en", async () => {
    svar([{ slug: "sovepose", buying_guide_entries: [{ rank: 0, affiliate_products: produkt() }] }]);
    const sti = ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h"]
      .find((s) => vaelgArm(s) === "ren" || vaelgArm(s) === "kontekst")!;
    const ud = await hentInFeedAnnonce(sti, [{ slug: "sovepose", reason: "Til vinteren" }]);
    expect(ud.vare?.begrundelse).toBe("Til vinteren");
    expect(ud.vare?.guideSlug).toBe("sovepose");
  });
});
