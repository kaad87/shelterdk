import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Antal varer med aegte prisfald pr. guide. Tallet staar paa guide-links paa
 * tusindvis af sider, saa to ting er lige saa vigtige som optaellingen:
 * det maa aldrig vaelte en side, og det maa ikke koste et opslag pr. render.
 */

const tabeller: Record<string, unknown[]> = {};
let kald = 0;
let fejl = false;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (t: string) => {
      kald++;
      const k: Record<string, unknown> = {
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve(
            fejl ? { data: null, error: { message: "nede" } } : { data: tabeller[t] ?? [], error: null }
          ).then(ok),
      };
      for (const m of ["select", "eq", "in"]) k[m] = () => k;
      return k;
    },
  }),
}));

const hentPrisfald = vi.fn();
vi.mock("../prisfald-opslag", () => ({ hentPrisfald: (...a: unknown[]) => hentPrisfald(...a) }));

import { taelPrisfald, getGuidePrisfaldAntal, _nulstilGuidePrisfaldCache } from "../guide-prisfald";

const fald = { foer: 739, nu: 495, pct: 33, siden: "2026-11-14" };

beforeEach(() => {
  _nulstilGuidePrisfaldCache();
  kald = 0;
  fejl = false;
  hentPrisfald.mockReset();
  tabeller.buying_guides = [
    { id: "g1", slug: "stormkoekken" },
    { id: "g2", slug: "sovepose" },
  ];
  tabeller.buying_guide_entries = [
    { guide_id: "g1", affiliate_product_id: "a" },
    { guide_id: "g1", affiliate_product_id: "b" },
    { guide_id: "g2", affiliate_product_id: "c" },
  ];
  tabeller.affiliate_products = [
    { id: "a", price: 495, in_stock: true, is_blocked: false },
    { id: "b", price: 495, in_stock: true, is_blocked: false },
    { id: "c", price: 899, in_stock: true, is_blocked: false },
  ];
});

describe("taelPrisfald", () => {
  const guider = [{ id: "g1", slug: "stormkoekken" }];
  const entries = [
    { guide_id: "g1", affiliate_product_id: "a" },
    { guide_id: "g1", affiliate_product_id: "b" },
    { guide_id: "g1", affiliate_product_id: "c" },
  ];

  it("taeller kun varer der kan koebes", () => {
    // En udsolgt vare med prisfald kan man ikke handle paa. Guiden viser den
    // nederst som udsolgt, og linket maa ikke love den.
    const varer = [
      { id: "a", in_stock: true, is_blocked: false },
      { id: "b", in_stock: false, is_blocked: false },
      { id: "c", in_stock: true, is_blocked: true },
    ];
    const ud = taelPrisfald(guider, entries, varer, new Map([["a", fald], ["b", fald], ["c", fald]]));
    expect(ud.get("stormkoekken")).toBe(1);
  });

  it("udelader guider uden prisfald", () => {
    const varer = [{ id: "a", in_stock: true, is_blocked: false }];
    expect(taelPrisfald(guider, entries, varer, new Map()).has("stormkoekken")).toBe(false);
  });

  it("taeller en vare der staar to gange i samme guide én gang", () => {
    const dobbelt = [...entries, { guide_id: "g1", affiliate_product_id: "a" }];
    const varer = [{ id: "a", in_stock: true, is_blocked: false }];
    expect(taelPrisfald(guider, dobbelt, varer, new Map([["a", fald]])).get("stormkoekken")).toBe(1);
  });
});

describe("getGuidePrisfaldAntal", () => {
  it("taeller pr. guide-slug", async () => {
    hentPrisfald.mockResolvedValue(new Map([["a", fald], ["b", fald]]));
    const ud = await getGuidePrisfaldAntal();
    expect(ud.get("stormkoekken")).toBe(2);
    expect(ud.has("sovepose")).toBe(false);
  });

  it("henter én gang og genbruger svaret", async () => {
    hentPrisfald.mockResolvedValue(new Map([["a", fald]]));
    await getGuidePrisfaldAntal();
    const efterFoerste = kald;
    await getGuidePrisfaldAntal();
    await getGuidePrisfaldAntal();
    expect(kald).toBe(efterFoerste);
    expect(hentPrisfald).toHaveBeenCalledTimes(1);
  });

  it("deler ét opslag mellem samtidige kald", async () => {
    hentPrisfald.mockResolvedValue(new Map([["a", fald]]));
    await Promise.all([getGuidePrisfaldAntal(), getGuidePrisfaldAntal(), getGuidePrisfaldAntal()]);
    expect(hentPrisfald).toHaveBeenCalledTimes(1);
  });

  it("giver et tomt svar i stedet for at kaste, og gemmer ikke fejlen", async () => {
    hentPrisfald.mockRejectedValue(new Error("timeout"));
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getGuidePrisfaldAntal()).size).toBe(0);
    stille.mockRestore();

    hentPrisfald.mockResolvedValue(new Map([["a", fald]]));
    expect((await getGuidePrisfaldAntal()).get("stormkoekken")).toBe(1);
  });

  it("giver et tomt svar naar databasen svarer med en fejl", async () => {
    fejl = true;
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getGuidePrisfaldAntal()).size).toBe(0);
    stille.mockRestore();
    expect(hentPrisfald).not.toHaveBeenCalled();
  });

  it("venter ikke paa et langsomt opslag, men gemmer svaret til naeste gang", async () => {
    // Shelter-siderne er dynamiske. Et koldt opslag maa ikke holde siden
    // tilbage; maerket kommer bare med paa naeste visning.
    let svar!: (m: Map<string, typeof fald>) => void;
    hentPrisfald.mockReturnValue(new Promise((r) => (svar = r)));
    expect((await getGuidePrisfaldAntal({ ventMs: 5 })).size).toBe(0);

    svar(new Map([["a", fald]]));
    await new Promise((r) => setTimeout(r, 0));
    expect((await getGuidePrisfaldAntal({ ventMs: 5 })).get("stormkoekken")).toBe(1);
    expect(hentPrisfald).toHaveBeenCalledTimes(1);
  });
});

describe("ventetiden", () => {
  it("venter laenge nok til et koldt opslag paa en ISR-side", async () => {
    // Alle sider med guide-links caches i 24 timer. Et maerkeloest svar
    // efter 1,5 s blev staaende paa forsiden et doegn.
    vi.useFakeTimers();
    let svar!: (m: Map<string, typeof fald>) => void;
    hentPrisfald.mockReturnValue(new Promise((r) => (svar = r)));
    const p = getGuidePrisfaldAntal();
    await vi.advanceTimersByTimeAsync(5000);
    svar(new Map([["a", fald]]));
    await vi.advanceTimersByTimeAsync(0);
    expect((await p).get("stormkoekken")).toBe(1);
    vi.useRealTimers();
  });
});
