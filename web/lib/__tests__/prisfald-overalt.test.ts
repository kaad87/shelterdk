import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * De sidste steder hvor en vare kan blive vist med rabat: grej-kort i
 * blogindlaeg og guidetekst (getProduct/getProducts), /julegaver og
 * /koeb-shelter. Alle skal vise vores maalte fald eller ingen rabat, og ved
 * en fejl INGEN rabat frem for feedets.
 */

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));

const tabeller: Record<string, unknown[]> = {};
function kaede(tabel: string) {
  const svar = { data: tabeller[tabel] ?? [], error: null };
  const k: Record<string, unknown> = {
    maybeSingle: async () => ({ data: (tabeller[tabel] ?? [])[0] ?? null, error: null }),
    then: (ok: (v: typeof svar) => unknown) => Promise.resolve(svar).then(ok),
  };
  for (const m of ["select", "eq", "neq", "not", "or", "gte", "lte", "in", "order", "limit"]) k[m] = () => k;
  return k;
}
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => kaede(t) }) }));
vi.mock("@/utils/supabase/server-public", () => ({ createPublicClient: () => ({ from: (t: string) => kaede(t) }) }));

let fald: Map<string, { foer: number; nu: number; pct: number; siden: string }> | Error = new Map();
vi.mock("@/lib/prisfald-opslag", async () => {
  const { medPrisfald } = await import("@/lib/prisfald");
  const hent = async () => {
    if (fald instanceof Error) throw fald;
    return fald;
  };
  return {
    hentPrisfald: hent,
    anvendPrisfald: async <T extends { id: string; price: number; price_original: number | null; discount_pct: number | null }>(v: T[]) => {
      const f = await hent();
      return v.map((x) => medPrisfald(x, f.get(x.id) ?? null));
    },
    anvendPrisfaldSikkert: async <T extends { id: string; price: number; price_original: number | null; discount_pct: number | null }>(v: T[]) => {
      try {
        const f = await hent();
        return v.map((x) => medPrisfald(x, f.get(x.id) ?? null));
      } catch {
        return v.map((x) => medPrisfald(x, null));
      }
    },
  };
});

import { getProduct, getProducts } from "@/lib/affiliate-products";
import { getGaveforslag } from "@/lib/kampagne";
import { getShelterAlternatives } from "@/lib/buy-shelter";

const vare = (id: string, ekstra: Record<string, unknown> = {}) => ({
  id,
  retailer: "backpackerlife",
  brand: null,
  product_name: `Vare ${id}`,
  display_name: null,
  display_brand: null,
  category_mapped: "telt",
  price: 4995,
  price_original: 8995,
  discount_pct: 44,
  in_stock: true,
  is_blocked: false,
  image_url: `https://example.com/${id}.jpg`,
  affiliate_url: `https://example.com/${id}`,
  ...ekstra,
});
const FALD = { foer: 5995, nu: 4995, pct: 17, siden: "2026-11-14" };

beforeEach(() => {
  for (const k of Object.keys(tabeller)) delete tabeller[k];
  fald = new Map([["a", FALD]]);
});

describe("getProducts og getProduct (grej-kort i tekst)", () => {
  it("giver vores fald til den vare der er faldet, og ingen rabat til resten", async () => {
    tabeller.affiliate_products = [vare("a"), vare("b")];
    const m = await getProducts(["a", "b"]);
    expect(m.get("a")).toMatchObject({ price_original: 5995, discount_pct: 17 });
    expect(m.get("b")).toMatchObject({ price_original: null, discount_pct: null, prisfald: null });
  });

  it("getProduct goer det samme", async () => {
    tabeller.affiliate_products = [vare("b")];
    expect(await getProduct("b")).toMatchObject({ price_original: null, prisfald: null });
  });

  it("viser ingen rabat, naar prisfaldene ikke kan slaas op", async () => {
    tabeller.affiliate_products = [vare("a")];
    fald = new Error("timeout");
    expect((await getProducts(["a"])).get("a")).toMatchObject({ price_original: null, discount_pct: null });
  });
});

describe("/julegaver", () => {
  it("giver gaveforslagene vores tal", async () => {
    // To guider: der vaelges kun ét forslag pr. guide pr. prisbaand.
    tabeller.buying_guides = [
      { id: "g1", slug: "telt", title: "Bedste telt" },
      { id: "g2", slug: "sovepose", title: "Bedste sovepose" },
    ];
    tabeller.buying_guide_entries = [
      { guide_id: "g1", rank: 0, score: 8, award_label: null, best_for: null, affiliate_product_id: "a" },
      { guide_id: "g2", rank: 0, score: 7, award_label: null, best_for: null, affiliate_product_id: "b" },
    ];
    tabeller.affiliate_products = [vare("a", { price: 299 }), vare("b", { price: 299 })];
    fald = new Map([["a", { ...FALD, nu: 299, foer: 399, pct: 25 }]]);
    const forslag = (await getGaveforslag()).flatMap((t) => t.forslag);
    const a = forslag.find((f) => f.product.id === "a")!.product;
    const b = forslag.find((f) => f.product.id === "b")!.product;
    expect(a.price_original).toBe(399);
    expect(b.price_original).toBeNull();
  });
});

describe("/koeb-shelter", () => {
  it("giver alternativerne vores tal", async () => {
    tabeller.affiliate_products = [vare("a", { product_name: "Glamping tipi A" }), vare("b", { product_name: "Lavvu B" })];
    const ud = await getShelterAlternatives(3);
    expect(ud.find((p) => p.id === "a")?.price_original).toBe(5995);
    expect(ud.find((p) => p.id === "b")?.price_original).toBeNull();
  });
});
