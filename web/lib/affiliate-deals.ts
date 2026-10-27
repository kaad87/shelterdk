import { createClient } from "@supabase/supabase-js";
import { FEED_KATEGORIER } from "./feed-kategori-filter";
import { fjernStoej } from "./deal-relevans";
import { navneKategorier } from "./kategori-fra-navn";
import type { AffiliateProduct } from "./affiliate-products";

/**
 * Kategorier som koden selv skriver paa produkterne.
 *
 * Whitelisten blev udelukkende laest af affiliate_category_mapping, som er
 * noeglet paa (retailer, category_raw) og kun udfyldes af den manuelle
 * kortlaegning i admin. To af de tre kilder til category_mapped gaar ikke den
 * vej:
 *
 *   FEED_KATEGORIER  de filtrerede feeds saetter category_mapped direkte paa
 *                    varen, fordi kategorien ER ShelterDK-kategorien.
 *                    Resultatet var, at 175 varer i seks kategorier
 *                    (vandresandal 35, fleece 43, solhat 31, vandrebukser 29,
 *                    dunjakke 22, oekse 15) aldrig naaede /tilbud.
 *
 *   navneKategorier  navnereglerne udfylder hullerne, naar hverken feedets
 *                    filter eller kortlaegningen kan svare. Uden dem her
 *                    ville de 39 nye baaludstyr-varer vaere kategoriseret og
 *                    alligevel usynlige paa /tilbud.
 *
 * Kilden er koden frem for en raekke i basen, saa en ny kategori ikke kraever
 * en migration, der kan glemmes. En kategori, koden selv kan tildele, er
 * kurateret pr. definition og hoerer derfor paa whitelisten.
 */
function filterKategorier(): string[] {
  return [...new Set([...FEED_KATEGORIER.map((k) => k.kategori), ...navneKategorier()])];
}

export interface DealsFilter {
  minDiscount?: number; // default 25
  retailer?: string;
  category?: string;
  sort?: "discount" | "price-asc" | "price-desc";
}

export function diversify(
  products: AffiliateProduct[],
  opts: { maxPerCategory: number; targetSize: number }
): AffiliateProduct[] {
  const result: AffiliateProduct[] = [];
  const counts = new Map<string, number>();
  for (const p of products) {
    const cat = p.category_mapped ?? "other";
    const current = counts.get(cat) ?? 0;
    if (current < opts.maxPerCategory) {
      result.push(p);
      counts.set(cat, current + 1);
    }
    if (result.length >= opts.targetSize) break;
  }
  return result;
}

/**
 * Stable sort: products with the same discount tier get re-ordered so
 * backpackerlife items come first. Higher-discount products still win
 * across tiers. Rationale: backpackerlife has better commission/conversion,
 * so when the user sees "5 equally discounted products", we prefer the
 * partner that pays us more.
 */
export function prioritizeBackpackerlife(
  products: AffiliateProduct[]
): AffiliateProduct[] {
  return [...products].sort((a, b) => {
    const da = a.discount_pct ?? 0;
    const db = b.discount_pct ?? 0;
    if (da !== db) return db - da;
    const ra = a.retailer === "backpackerlife" ? 0 : 1;
    const rb = b.retailer === "backpackerlife" ? 0 : 1;
    return ra - rb;
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SELECT_COLUMNS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked";

/**
 * Fetches top deals, filtered by whitelisted categories and optional params.
 * Over-fetches, applies retailer priority, and then diversifies.
 */
export async function getTopDeals(
  filter: DealsFilter = {}
): Promise<AffiliateProduct[]> {
  const supabase = getSupabase();
  const { data: whitelisted } = await supabase
    .from("affiliate_category_mapping")
    .select("category_mapped")
    .eq("whitelisted", true)
    .not("category_mapped", "is", null);
  const allowedCats = [
    ...new Set([
      ...((whitelisted ?? [])
        .map((r: { category_mapped: string | null }) => r.category_mapped)
        .filter(Boolean) as string[]),
      ...filterKategorier(),
    ]),
  ];
  if (allowedCats.length === 0) return [];

  let q = supabase
    .from("affiliate_products")
    .select(SELECT_COLUMNS)
    .eq("in_stock", true)
    .eq("is_blocked", false)
    .gte("discount_pct", filter.minDiscount ?? 25)
    .gte("price", 100)
    .in("category_mapped", filter.category ? [filter.category] : allowedCats);

  // Sorting
  if (filter.sort === "price-asc") {
    q = q.order("price", { ascending: true });
  } else if (filter.sort === "price-desc") {
    q = q.order("price", { ascending: false });
  } else {
    q = q
      .order("discount_pct", { ascending: false })
      .order("last_seen_at", { ascending: false });
  }

  q = q.limit(200);
  if (filter.retailer) q = q.eq("retailer", filter.retailer);

  const { data } = await q;
  // Stoejen fjernes FOER prioritering og diversify, saa de 40 pladser bliver
  // fyldt med varer der duer. Laa foer kun i guidernes tilbudsblok, saa
  // /tilbud var ubeskyttet: 4 af de 40 viste varer var en cykellygte og tre
  // varianter af den samme proptraekker.
  const products = fjernStoej((data as AffiliateProduct[]) ?? []);
  // Only re-sort by retailer priority when sorting by discount (default)
  const sorted =
    filter.sort === "price-asc" || filter.sort === "price-desc"
      ? products
      : prioritizeBackpackerlife(products);
  // When filtering by single category, allow more per category
  const maxPerCat = filter.category ? 40 : 4;
  return diversify(sorted, { maxPerCategory: maxPerCat, targetSize: 40 });
}

/**
 * Returns the list of whitelisted category slugs (for filter UI).
 */
export async function getWhitelistedCategories(): Promise<string[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("affiliate_category_mapping")
    .select("category_mapped")
    .eq("whitelisted", true)
    .not("category_mapped", "is", null);
  return [
    ...new Set([
      ...((data ?? [])
        .map((r: { category_mapped: string | null }) => r.category_mapped)
        .filter(Boolean) as string[]),
      ...filterKategorier(),
    ]),
  ].sort();
}
