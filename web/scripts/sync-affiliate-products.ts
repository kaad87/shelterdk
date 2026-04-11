/**
 * Nightly sync of affiliate product feeds → Supabase.
 *
 * Runs via:
 *   - `npm run sync-products` (local)
 *   - Netlify scheduled function (nightly)
 *   - `POST /api/admin/affiliate-products/sync` (manual trigger from admin UI)
 *
 * Reads XML from three partner-ads URLs, normalizes, upserts, then marks
 * products not seen in the last 7 days as out-of-stock.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  parseFeedXml,
  type NormalizedProduct,
  type Retailer,
} from "../lib/parseAffiliateFeed";

const FEEDS: { retailer: Retailer; envVar: string }[] = [
  { retailer: "backpackerlife", envVar: "PARTNER_ADS_BACKPACKERLIFE_URL" },
  { retailer: "outdoortid", envVar: "PARTNER_ADS_OUTDOORTID_URL" },
  { retailer: "outmore", envVar: "PARTNER_ADS_OUTMORE_URL" },
];

interface SyncResult {
  retailer: Retailer;
  total: number;
  inserted: number;
  updated: number;
  error?: string;
}

async function fetchFeed(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ShelterDK/1.0 (+https://shelterdk.dk)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upsertCategoryMappings(
  supabase: SupabaseClient,
  products: NormalizedProduct[]
): Promise<Map<string, { mapped: string | null; whitelisted: boolean }>> {
  // Collect unique (retailer, category_raw) pairs
  const uniquePairs = new Map<
    string,
    { retailer: Retailer; category_raw: string }
  >();
  for (const p of products) {
    if (p.category_raw) {
      const key = `${p.retailer}::${p.category_raw}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, {
          retailer: p.retailer,
          category_raw: p.category_raw,
        });
      }
    }
  }

  // Insert any new ones (ON CONFLICT DO NOTHING — via ignoreDuplicates)
  if (uniquePairs.size > 0) {
    const rows = [...uniquePairs.values()].map((v) => ({
      retailer: v.retailer,
      category_raw: v.category_raw,
      category_mapped: null,
      whitelisted: false,
    }));
    await supabase.from("affiliate_category_mapping").upsert(rows, {
      onConflict: "retailer,category_raw",
      ignoreDuplicates: true,
    });
  }

  // Read all mappings back to get the current whitelist state
  const { data } = await supabase
    .from("affiliate_category_mapping")
    .select("retailer, category_raw, category_mapped, whitelisted");

  const map = new Map<
    string,
    { mapped: string | null; whitelisted: boolean }
  >();
  for (const row of (data ?? []) as Array<{
    retailer: string;
    category_raw: string;
    category_mapped: string | null;
    whitelisted: boolean;
  }>) {
    map.set(`${row.retailer}::${row.category_raw}`, {
      mapped: row.category_mapped,
      whitelisted: row.whitelisted,
    });
  }
  return map;
}

async function syncRetailer(
  supabase: SupabaseClient,
  retailer: Retailer,
  url: string
): Promise<SyncResult> {
  console.log(`[${retailer}] fetching ${url}`);
  const buffer = await fetchFeed(url);
  console.log(`[${retailer}] parsing ${buffer.length} bytes`);
  const products = parseFeedXml(buffer, retailer);
  console.log(`[${retailer}] parsed ${products.length} products`);

  const mappingLookup = await upsertCategoryMappings(supabase, products);

  const now = new Date().toISOString();
  const rows = products.map((p) => {
    const key = p.category_raw ? `${p.retailer}::${p.category_raw}` : null;
    const mapping = key ? mappingLookup.get(key) : null;
    return {
      id: p.id,
      retailer: p.retailer,
      retailer_product_id: p.retailer_product_id,
      brand: p.brand,
      product_name: p.product_name,
      description: p.description,
      category_raw: p.category_raw,
      category_mapped: mapping?.mapped ?? null,
      price: p.price,
      price_original: p.price_original,
      discount_pct: p.discount_pct,
      shipping_cost: p.shipping_cost,
      in_stock: p.in_stock,
      stock_count: p.stock_count,
      image_url: p.image_url,
      affiliate_url: p.affiliate_url,
      ean: p.ean,
      last_seen_at: now,
    };
  });

  // Upsert in batches of 500 to avoid payload limits
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("affiliate_products")
      .upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Upsert failed (batch ${i}): ${error.message}`);
    console.log(`[${retailer}] upserted ${i + batch.length}/${rows.length}`);
  }

  return {
    retailer,
    total: products.length,
    inserted: 0, // Supabase upsert doesn't distinguish; could track via returning later
    updated: 0,
  };
}

async function markStaleProducts(supabase: SupabaseClient) {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await supabase
    .from("affiliate_products")
    .update({ in_stock: false })
    .lt("last_seen_at", sevenDaysAgo)
    .eq("in_stock", true);
  if (error) throw new Error(`Mark-stale failed: ${error.message}`);
}

export async function runSync(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: run } = await supabase
    .from("affiliate_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = (run as { id?: number } | null)?.id;

  let total = 0;
  try {
    for (const { retailer, envVar } of FEEDS) {
      const url = process.env[envVar];
      if (!url) {
        console.warn(`[${retailer}] skipping — ${envVar} not set`);
        continue;
      }
      const result = await syncRetailer(supabase, retailer, url);
      total += result.total;
    }

    await markStaleProducts(supabase);

    if (runId != null) {
      await supabase
        .from("affiliate_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          products_total: total,
        })
        .eq("id", runId);
    }
    console.log(`✓ sync complete: ${total} products`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ sync failed: ${msg}`);
    if (runId != null) {
      await supabase
        .from("affiliate_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq("id", runId);
    }
    throw err;
  }
}

// When run directly via `tsx scripts/sync-affiliate-products.ts`
if (require.main === module) {
  // Load .env.local if present (for local runs)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: ".env.local" });
  } catch {
    /* dotenv not available — production env vars assumed */
  }
  runSync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
