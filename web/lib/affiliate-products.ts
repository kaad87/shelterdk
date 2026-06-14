import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AffiliateProduct {
  id: string;
  retailer: "outmore" | "backpackerlife" | "outdoortid";
  brand: string | null;
  product_name: string;
  description: string | null;
  category_mapped: string | null;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  in_stock: boolean;
  stock_count: number | null;
  image_url: string;
  affiliate_url: string;
  is_blocked: boolean;
  shipping_cost: number | null;
  updated_at?: string;
  /** Sættes til now() ved hver feed-sync — den ærlige "pris/lager tjekket"-dato. */
  last_seen_at?: string;
}

const SELECT_COLUMNS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked, shipping_cost, updated_at";

/**
 * Fetches a single product by id. Cached at the React request level to
 * dedupe within a single render pass. Returns null if not found.
 */
export const getProduct = cache(
  async (id: string): Promise<AffiliateProduct | null> => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("affiliate_products")
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    return (data as AffiliateProduct | null) ?? null;
  }
);

/**
 * Batched fetch: pass a list of ids, get a Map<id, product>.
 * Missing ids are omitted from the map.
 */
export const getProducts = cache(
  async (ids: string[]): Promise<Map<string, AffiliateProduct>> => {
    if (ids.length === 0) return new Map();
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("affiliate_products")
      .select(SELECT_COLUMNS)
      .in("id", ids);
    const result = new Map<string, AffiliateProduct>();
    for (const row of (data as AffiliateProduct[]) ?? []) result.set(row.id, row);
    return result;
  }
);
