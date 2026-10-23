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
import { FEEDS, feedUrl, type FeedDef } from "../lib/affiliate-feeds";
import { kategoriFor, prisOk } from "../lib/feed-kategori-filter";
import { vaelgUdvalg, basisNavn } from "../lib/feed-udvalg";

/**
 * Feedets adresse.
 *
 * Env-variablen har forrang, saa de tre oprindelige feeds koerer videre paa
 * praecis den adresse Netlify allerede har, ogsaa hvis den afviger fra den
 * sammensatte. Uden env falder den tilbage paa banner- og feed-id i
 * lib/affiliate-feeds.ts, saa et nyt feed er en linje i en diff og ikke en
 * indstilling, nogen skal huske at saette i to miljoeer.
 */
function urlFor(f: FeedDef): string | null {
  const fraEnv = process.env[`PARTNER_ADS_${f.retailer.toUpperCase()}_URL`];
  if (fraEnv) return fraEnv;
  return f.bannerId && f.feedId ? feedUrl(f) : null;
}

/** ShelterDK-kategorien for en vare i et filtreret feed, eller null. */
function kategorien(p: NormalizedProduct): string | null {
  const k = kategoriFor(p.product_name, p.category_raw);
  return k && prisOk(k, p.price) ? k : null;
}

/**
 * Id'er vi allerede har gemt for en forhandler.
 *
 * Bruges til at holde udvalget stabilt: en vare, vi allerede har, beholder sin
 * plads under loftet, saa en guide aldrig kommer til at pege paa en raekke der
 * er forsvundet. Sides igennem, fordi Supabase svarer med hoejst 1.000 raekker.
 */
async function hentGemteIds(
  supabase: SupabaseClient,
  retailer: Retailer
): Promise<Set<string>> {
  const ud = new Set<string>();
  const SIDE = 1000;
  for (let fra = 0; ; fra += SIDE) {
    const { data, error } = await supabase
      .from("affiliate_products")
      .select("id")
      .eq("retailer", retailer)
      .range(fra, fra + SIDE - 1);
    if (error) throw new Error(`Kunne ikke laese gemte id'er: ${error.message}`);
    const side = (data ?? []) as { id: string }[];
    for (const r of side) ud.add(r.id);
    if (side.length < SIDE) return ud;
  }
}

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
  feed: FeedDef,
  url: string
): Promise<SyncResult> {
  const retailer = feed.retailer as Retailer;
  console.log(`[${retailer}] fetching ${url}`);
  const buffer = await fetchFeed(url);
  console.log(`[${retailer}] parsing ${buffer.length} bytes`);
  const products = parseFeedXml(buffer, retailer);
  console.log(`[${retailer}] parsed ${products.length} products`);

  // Deduplicate by id — some feeds contain the same product multiple times
  const seen = new Map<string, NormalizedProduct>();
  for (const p of products) seen.set(p.id, p);
  let unique = [...seen.values()];
  if (unique.length < products.length) {
    console.log(`[${retailer}] deduplicated ${products.length} → ${unique.length}`);
  }

  // Et feed med loft importeres ikke helt: kun de kategorier vi har brug for,
  // og kun et stabilt udvalg inden for hver. Udvalget laegges FOER
  // kategorikortlaegningen, saa et feed med 49.556 varer ikke registrerer
  // tusindvis af raa kategorinavne, vi aldrig kommer til at bruge.
  if (feed.loftPrKategori != null) {
    const gemte = await hentGemteIds(supabase, retailer);
    const { valgte, prKategori } = vaelgUdvalg(
      unique,
      kategorien,
      gemte,
      feed.loftPrKategori,
      feed.maksPrBrand
    );
    const fordeling = [...prKategori]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
    console.log(
      `[${retailer}] udvalg ${unique.length} → ${valgte.length} (${fordeling || "ingen"})`
    );
    unique = valgte;
  }

  const mappingLookup = await upsertCategoryMappings(supabase, unique);

  const now = new Date().toISOString();
  const rows = unique.map((p) => {
    const key = p.category_raw ? `${p.retailer}::${p.category_raw}` : null;
    const mapping = key ? mappingLookup.get(key) : null;
    // I et filtreret feed kender vi kategorien fra filteret, og den er bedre
    // end den manuelle kortlaegning: den er allerede ShelterDK-kategorien, saa
    // varerne kan findes i admin og bruges i en guide fra foerste synk.
    const kat = feed.loftPrKategori != null ? kategorien(p) : null;
    // Navnet uden farve og stoerrelse i de filtrerede feeds.
    //
    // Outdoornu skriver "Fjällräven Expedition Pack Down Jacket Men-navy-2XL",
    // men vareurl peger paa produktsiden, hvor man selv vaelger farve og
    // stoerrelse. Navnet var derfor baade grimt paa et produktkort og
    // misvisende om hvad linket faerer til. De tre oprindelige feeds roeres
    // ikke: deres navne staar i live guider i forvejen.
    const navn = feed.loftPrKategori != null ? basisNavn(p.product_name) : p.product_name;
    return {
      id: p.id,
      retailer: p.retailer,
      retailer_product_id: p.retailer_product_id,
      brand: p.brand,
      product_name: navn,
      description: p.description,
      category_raw: p.category_raw,
      category_mapped: kat ?? mapping?.mapped ?? null,
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

  // Upsert in smaller batches with retry/backoff. Smaller batches stay under the
  // Postgres statement_timeout (important when the DB is throttled/under load), and
  // the retry means a single transient timeout doesn't abort the whole sync.
  const BATCH = 150;
  const MAX_ATTEMPTS = 4;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    let lastError: string | null = null;
    let brugteForsoeg = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      brugteForsoeg = attempt;
      const { error } = await supabase
        .from("affiliate_products")
        .upsert(batch, { onConflict: "id" });
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error.message;
      // Klasse 23 er brud paa en constraint: samme data giver samme fejl, saa
      // der er intet at vinde ved at proeve igen. Der brydes ud, og ikke bare
      // springes ventetiden over: en afvist raekke blev ellers sendt til
      // databasen fire gange for at faa det samme svar fire gange.
      if (typeof error.code === "string" && error.code.startsWith("23")) break;
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
        console.warn(`[${retailer}] batch ${i} fejl (forsøg ${attempt}/${MAX_ATTEMPTS}): ${error.message} — prøver igen om ${backoffMs}ms`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
    // Det faktiske antal forsoeg, ikke MAX_ATTEMPTS. Beskeden sagde "efter 4
    // forsoeg" ogsaa naar der kun havde vaeret ét, og sendte fejlsoegningen
    // efter et netvaerksproblem i stedet for efter den constraint, der afviste.
    if (lastError) {
      throw new Error(`Upsert failed (batch ${i}) efter ${brugteForsoeg} forsøg: ${lastError}`);
    }
    console.log(`[${retailer}] upserted ${i + batch.length}/${rows.length}`);
  }

  return {
    retailer,
    // Hvad der blev GEMT, ikke hvad feedet indeholdt. De to filtrerede feeds
    // har 82.000 varer og gemmer 125; med products.length ville
    // affiliate_sync_runs.products_total melde 95.000 produkter, som ikke
    // findes i tabellen, og admin-dashboardet viser netop det tal.
    total: rows.length,
    inserted: 0, // Supabase upsert doesn't distinguish; could track via returning later
    updated: 0,
  };
}

/**
 * Freshness-motor: bump kun en købsguides `updated_at`, når et af dens
 * produkter FAKTISK har ændret pris/lager i denne sync — så sitemap-lastmod og
 * JSON-LD dateModified afspejler reelle ændringer (ikke daglig inflation).
 * Helt selvstændig og defensiv: en fejl her må aldrig vælte selve synken.
 */
interface GuideProductState {
  signatures: Map<string, string>;
  productToGuides: Map<string, Set<number>>;
}

function productSignature(p: {
  price: number | null;
  price_original: number | null;
  discount_pct: number | null;
  in_stock: boolean | null;
}): string {
  return `${p.price}|${p.price_original}|${p.discount_pct}|${p.in_stock}`;
}

async function captureGuideProductState(
  supabase: SupabaseClient
): Promise<GuideProductState | null> {
  try {
    const { data: guides } = await supabase
      .from("buying_guides")
      .select("id")
      .eq("status", "published");
    const guideIds = (guides ?? []).map((g: { id: number }) => g.id);
    if (!guideIds.length) return null;

    const { data: entries } = await supabase
      .from("buying_guide_entries")
      .select("guide_id, affiliate_product_id")
      .in("guide_id", guideIds);

    const productToGuides = new Map<string, Set<number>>();
    for (const e of (entries ?? []) as Array<{
      guide_id: number;
      affiliate_product_id: string | null;
    }>) {
      if (!e.affiliate_product_id) continue;
      const set = productToGuides.get(e.affiliate_product_id) ?? new Set<number>();
      set.add(e.guide_id);
      productToGuides.set(e.affiliate_product_id, set);
    }

    const ids = [...productToGuides.keys()];
    const signatures = new Map<string, string>();
    if (ids.length) {
      const { data: prods } = await supabase
        .from("affiliate_products")
        .select("id, price, price_original, discount_pct, in_stock")
        .in("id", ids);
      for (const p of (prods ?? []) as Array<
        { id: string } & Parameters<typeof productSignature>[0]
      >) {
        signatures.set(p.id, productSignature(p));
      }
    }
    return { signatures, productToGuides };
  } catch (err) {
    console.warn(
      "guide-freshness: capture skipped:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

async function bumpChangedGuides(
  supabase: SupabaseClient,
  before: GuideProductState | null
): Promise<void> {
  if (!before) return;
  try {
    const ids = [...before.productToGuides.keys()];
    if (!ids.length) return;

    const { data: prods } = await supabase
      .from("affiliate_products")
      .select("id, price, price_original, discount_pct, in_stock")
      .in("id", ids);

    const changedGuides = new Set<number>();
    for (const p of (prods ?? []) as Array<
      { id: string } & Parameters<typeof productSignature>[0]
    >) {
      const prev = before.signatures.get(p.id);
      if (prev !== undefined && prev !== productSignature(p)) {
        for (const gid of before.productToGuides.get(p.id) ?? []) changedGuides.add(gid);
      }
    }

    if (!changedGuides.size) {
      console.log("guide-freshness: ingen guide-produkter ændret");
      return;
    }
    const { error } = await supabase
      .from("buying_guides")
      .update({ updated_at: new Date().toISOString() })
      .in("id", [...changedGuides]);
    if (error) throw new Error(error.message);
    console.log(
      `guide-freshness: bumpede ${changedGuides.size} guide(r) med reelle pris/lager-ændringer`
    );
  } catch (err) {
    console.warn(
      "guide-freshness: bump skipped:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Afmeld varer vi ikke har set i feedet i syv dage.
 *
 * @param retailers de forhandlere der faktisk blev synket. Tom = alle.
 *
 * Afgraensningen er ikke pynt. Reglen "ikke set i syv dage" er kun sand for et
 * feed vi HAR hentet, og med forhandler-filteret kan en koersel nu daekke to af
 * fem feeds. Uden afgraensningen ville `sync-products prooutdoor` syv dage i
 * traek afmelde hele kataloget fra de tre feeds, den aldrig har rørt, og uden
 * en fejl undervejs.
 *
 * En fuld koersel sender en tom liste og fejer bredt, saa et feed der er taget
 * ud af FEEDS ogsaa bliver afmeldt frem for at staa som paa lager for altid.
 */
async function markStaleProducts(
  supabase: SupabaseClient,
  retailers: string[] = []
) {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  let q = supabase
    .from("affiliate_products")
    .update({ in_stock: false })
    .lt("last_seen_at", sevenDaysAgo)
    .eq("in_stock", true);
  if (retailers.length) q = q.in("retailer", retailers);
  const { error } = await q;
  if (error) throw new Error(`Mark-stale failed: ${error.message}`);
}

/**
 * @param kun  koer kun disse forhandlere. Tom = alle.
 *
 * Findes for at kunne tage et enkelt feed ind uden at hente de fire andre.
 * Det nattelige job kalder uden argumenter og er uaendret.
 */
export async function runSync(kun: string[] = []): Promise<void> {
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
    // Snapshot guide-produkternes pris/lager FØR feeds opdaterer dem.
    const guideStateBefore = await captureGuideProductState(supabase);

    const valgteFeeds = kun.length
      ? FEEDS.filter((f) => kun.includes(f.retailer))
      : FEEDS;
    if (kun.length && valgteFeeds.length !== kun.length) {
      const kendte = FEEDS.map((f) => f.retailer).join(", ");
      throw new Error(`Ukendt forhandler i ${kun.join(", ")}. Kendte: ${kendte}`);
    }

    for (const feed of valgteFeeds) {
      const url = urlFor(feed);
      if (!url) {
        console.warn(`[${feed.retailer}] springes over — ingen adresse`);
        continue;
      }
      const result = await syncRetailer(supabase, feed, url);
      total += result.total;
    }

    // `kun` og ikke valgteFeeds: en fuld koersel skal feje bredt. Fjernes et
    // feed fra FEEDS, er dets varer ikke laengere i valgteFeeds, og de ville
    // saa blive staaende som "paa lager" for altid med doede links i guiderne.
    await markStaleProducts(supabase, kun);

    // Bump kun guider hvis et produkts pris/lager reelt ændrede sig.
    await bumpChangedGuides(supabase, guideStateBefore);

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
  const kun = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  runSync(kun).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
