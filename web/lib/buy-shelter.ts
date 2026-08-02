import { createPublicClient } from "@/utils/supabase/server-public";
import type { AffiliateProduct } from "@/lib/affiliate-products";

/**
 * Produkter til /koeb-shelter.
 *
 * ÆRLIGHED OM MATCHET: vores affiliate-katalog indeholder IKKE træ-shelters til
 * haven — det er dem folk primært søger efter ("køb shelter", "billig shelter"),
 * og de sælges af byggemarkeder vi ikke har aftale med. Det vi kan tilbyde er
 * det flytbare alternativ: tipier, lavvuer og store telte. Derfor præsenteres de
 * som netop et alternativ på siden, ikke som "shelters".
 */

const SELECT =
  "id, retailer, brand, product_name, description, category_raw, category_mapped, price, price_original, discount_pct, shipping_cost, in_stock, stock_count, image_url, affiliate_url, ean, specs, editor_score, is_blocked";

const TTL_MS = 60 * 60 * 1000;
let cache: { products: AffiliateProduct[]; expires: number } | null = null;
let inflight: Promise<AffiliateProduct[]> | null = null;

/**
 * Flytbare alternativer til et fast shelter: tipi/lavvu-agtige telte i den
 * større ende. Hentes dynamisk, så et udgået produkt forsvinder af sig selv i
 * stedet for at efterlade et dødt link.
 */
/**
 * Vælger `limit` produkter spredt jævnt over prisintervallet i stedet for de
 * billigste — så læseren ser spændvidden (budget/mellem/premium) frem for tre
 * varianter af samme serie.
 */
function spreadByPrice(products: AffiliateProduct[], limit: number): AffiliateProduct[] {
  if (products.length <= limit) return products;
  const step = (products.length - 1) / (limit - 1);
  const out: AffiliateProduct[] = [];
  for (let i = 0; i < limit; i++) {
    const p = products[Math.round(i * step)];
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export async function getShelterAlternatives(limit = 3): Promise<AffiliateProduct[]> {
  if (cache && cache.expires > Date.now()) return spreadByPrice(cache.products, limit);
  if (inflight) return spreadByPrice(await inflight, limit);

  inflight = (async () => {
    try {
      // Kun ægte tipi/lavvu/glamping-telte. Et bredt category_mapped="telt"-filter
      // gav almindelige familiecampingtelte (Easy Camp, Outwell), og at kalde dem
      // "alternativ til et shelter i haven" ville være misvisende.
      const { data, error } = await createPublicClient()
        .from("affiliate_products")
        .select(SELECT)
        .neq("in_stock", false)
        .not("is_blocked", "is", true)
        .or("product_name.ilike.%tipi%,product_name.ilike.%lavvu%,product_name.ilike.%glamping%")
        .gte("price", 3000)
        .lte("price", 20000)
        .not("product_name", "ilike", "%tilbehør%")
        .not("product_name", "ilike", "%gulv%")
        .not("product_name", "ilike", "%floor%")
        .not("product_name", "ilike", "%inner%")
        .not("product_name", "ilike", "%ovn%")
        .not("product_name", "ilike", "%stove%")
        .not("product_name", "ilike", "%fleece%")
        .order("price", { ascending: true })
        .limit(12);

      if (error) {
        console.error("Supabase error (shelter alternatives):", error);
        return [];
      }
      // Dedupliker farvevarianter: feedet har fx "Glamping tipi telt - Large - Grøn"
      // og "- Beige" som separate produkter, og at vise samme telt to gange af tre
      // pladser er spild. Nøglen er navnet uden det sidste bindestreg-led.
      const seen = new Set<string>();
      const list: AffiliateProduct[] = [];
      for (const p of (data as unknown as AffiliateProduct[]) ?? []) {
        const key = (p.product_name ?? "")
          .toLowerCase()
          .replace(/\s*-\s*[^-]+$/, "")
          .trim();
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(p);
      }
      if (list.length > 0) cache = { products: list, expires: Date.now() + TTL_MS };
      return list;
    } catch (err) {
      console.error("Supabase error (shelter alternatives):", err);
      return [];
    } finally {
      inflight = null;
    }
  })();

  return spreadByPrice(await inflight, limit);
}
