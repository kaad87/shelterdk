import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * KOBLINGEN, ikke reglen. lib/prisfald.ts kan vaere nok saa rigtig; den
 * hjaelper ikke hvis getTopDeals eller getGuideBySlug holder op med at kalde
 * den. Saa viser siderne igen feedets rabat, og ingen test ville opdage det.
 */

const tabeller: Record<string, unknown[]> = {};

/** Minimal PostgREST-kaede: alle filtre returnerer kaeden, og den kan awaites. */
function kaede(tabel: string) {
  const svar = { data: tabeller[tabel] ?? [], error: null };
  const k: Record<string, unknown> = {
    maybeSingle: async () => ({ data: (tabeller[tabel] ?? [])[0] ?? null, error: null }),
    then: (ok: (v: typeof svar) => unknown) => Promise.resolve(svar).then(ok),
  };
  for (const m of ["select", "eq", "not", "gte", "in", "order", "limit", "range"]) k[m] = () => k;
  return k;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => kaede(t) }),
}));

const anvendPrisfald = vi.fn();
vi.mock("../prisfald-opslag", () => ({ anvendPrisfald: (...a: unknown[]) => anvendPrisfald(...a) }));

import { getTopDeals } from "../affiliate-deals";
import { getGuideBySlug } from "../buying-guides";
import { medPrisfald, type Prisfald } from "../prisfald";

const vare = (id: string, navn: string, ekstra: Record<string, unknown> = {}) => ({
  id,
  retailer: "backpackerlife",
  brand: "Trangia",
  product_name: navn,
  display_name: null,
  display_brand: null,
  ean: null,
  description: null,
  category_mapped: "stormkoekken",
  price: 495,
  price_original: 899,
  discount_pct: 45,
  in_stock: true,
  stock_count: null,
  image_url: `https://example.com/${id}.jpg`,
  affiliate_url: `https://example.com/${id}`,
  is_blocked: false,
  ...ekstra,
});

const fald = (pct: number): Prisfald => ({ foer: 739, nu: 495, pct, siden: "2026-11-14" });

/** Svarer som den rigtige anvendPrisfald, men med faldene givet udefra. */
function medFald(kort: Record<string, Prisfald | null>) {
  anvendPrisfald.mockImplementation(async (varer: ReturnType<typeof vare>[]) =>
    varer.map((v) => medPrisfald(v, kort[v.id] ?? null))
  );
}

beforeEach(() => {
  anvendPrisfald.mockReset();
  for (const k of Object.keys(tabeller)) delete tabeller[k];
  tabeller.affiliate_category_mapping = [{ category_mapped: "stormkoekken" }];
});

describe("getTopDeals", () => {
  it("viser kun varer vi selv har set falde, uanset hvad feedet paastaar", async () => {
    tabeller.affiliate_products = [
      vare("a", "Stormkøkken Trangia 25-3"),
      vare("b", "Stormkøkken Trangia 27-1", { discount_pct: 70, price_original: 1650 }),
    ];
    medFald({ a: fald(33), b: null });

    const ud = await getTopDeals({ category: "stormkoekken" });
    expect(ud.map((p) => p.id)).toEqual(["a"]);
  });

  it("viser vores tal og ikke feedets", async () => {
    tabeller.affiliate_products = [vare("a", "Stormkøkken Trangia 25-3")];
    medFald({ a: fald(33) });

    const [p] = await getTopDeals({ category: "stormkoekken" });
    expect(p.discount_pct).toBe(33);
    expect(p.price_original).toBe(739);
    expect(p.prisfald?.siden).toBe("2026-11-14");
  });

  it("holder graensen paa 25 % mod vores eget tal", async () => {
    // Feedet siger 45 %, men maalt mod den laveste pris vi har set er det 12.
    tabeller.affiliate_products = [vare("a", "Stormkøkken Trangia 25-3")];
    medFald({ a: fald(12) });
    expect(await getTopDeals({ category: "stormkoekken" })).toEqual([]);
  });

  it("viser ingenting, hvis historikken ikke kan laeses", async () => {
    // Og falder IKKE tilbage paa feedets tal. Forsiden kalder herfra og maa
    // heller ikke vaelte.
    tabeller.affiliate_products = [vare("a", "Stormkøkken Trangia 25-3")];
    anvendPrisfald.mockRejectedValue(new Error("timeout"));
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getTopDeals({ category: "stormkoekken" })).toEqual([]);
    stille.mockRestore();
  });
});

describe("getGuideBySlug", () => {
  it("giver guidens varer vores prisfald i stedet for feedets rabat", async () => {
    tabeller.buying_guides = [{ id: "g1", slug: "stormkoekken", status: "published" }];
    tabeller.buying_guide_entries = [
      { id: "e1", rank: 0, award_label: "Vores valg", affiliate_product_id: "a" },
      { id: "e2", rank: 1, award_label: null, affiliate_product_id: "b" },
    ];
    tabeller.affiliate_products = [
      vare("a", "Stormkøkken Trangia 25-3"),
      vare("b", "Stormkøkken Trangia 27-1"),
    ];
    medFald({ a: fald(33), b: null });

    const ud = await getGuideBySlug("stormkoekken");
    const a = ud!.entries.find((e) => e.product.id === "a")!.product;
    const b = ud!.entries.find((e) => e.product.id === "b")!.product;
    expect(a.prisfald?.pct).toBe(33);
    expect(a.price_original).toBe(739);
    // b staar i feedet med 45 % rabat. Vi har ikke set den falde.
    expect(b.prisfald).toBeNull();
    expect(b.price_original).toBeNull();
    expect(b.discount_pct).toBeNull();
  });

  it("lader fejlen slippe igennem, saa ISR beholder den forrige side", async () => {
    tabeller.buying_guides = [{ id: "g1", slug: "stormkoekken", status: "published" }];
    tabeller.buying_guide_entries = [{ id: "e1", rank: 0, award_label: null, affiliate_product_id: "a" }];
    tabeller.affiliate_products = [vare("a", "Stormkøkken Trangia 25-3")];
    anvendPrisfald.mockRejectedValue(new Error("timeout"));
    await expect(getGuideBySlug("stormkoekken")).rejects.toThrow("timeout");
  });
});
