/**
 * Koerer migrations/068_prishistorik_baseline.sql gennem service_role.
 *
 * Migrationen er ren DML, saa den behoever ikke en psql-forbindelse: den kan
 * udfoeres som en upsert over REST. Scriptet findes for at slippe for at
 * vente paa en manuel koersel, og fordi det kan taelle hvad der faktisk blev
 * skrevet.
 *
 * Koerer:
 *   npm run prishistorik-baseline           # taeller op, skriver ikke
 *   npm run prishistorik-baseline -- --skriv
 *
 * Idempotent: unique (product_id, observeret) fra 067 + ignoreDuplicates, saa
 * en gentaget koersel samme dag tilfoejer ingenting.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv ikke tilgaengelig - produktions-env antages */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

interface Vare {
  id: string;
  price: number | null;
  price_original: number | null;
  in_stock: boolean;
}

/**
 * Alle varer med en pris, 1.000 ad gangen.
 *
 * Kaster ved fejl i stedet for at behandle en fejlet side som "ikke flere
 * raekker", samme grund som i guide-health-report.ts: en tavs afkortning ville
 * give en baseline der kun daekker en del af kataloget, og det ville ingen
 * opdage.
 */
async function hentVarer(db: SupabaseClient): Promise<Vare[]> {
  const ud: Vare[] = [];
  const SIDE = 1000;
  for (let fra = 0; ; fra += SIDE) {
    const { data, error } = await db
      .from("affiliate_products")
      .select("id, price, price_original, in_stock")
      .not("price", "is", null)
      .order("id")
      .range(fra, fra + SIDE - 1);
    if (error) throw new Error(`Kunne ikke laese varer: ${error.message}`);
    const side = (data ?? []) as Vare[];
    ud.push(...side);
    if (side.length < SIDE) return ud;
  }
}

async function main(): Promise<void> {
  const skriv = process.argv.includes("--skriv");
  const idag = new Date(new Date().toISOString()).toISOString().slice(0, 10);

  const varer = await hentVarer(sb);
  console.log(`${varer.length} varer med en pris`);

  const { count: foer } = await sb
    .from("affiliate_price_history")
    .select("*", { count: "exact", head: true });
  console.log(`prishistorik foer: ${foer ?? 0} raekker`);

  if (!skriv) {
    console.log(`\nTOERLOEB. Ville skrive ${varer.length} raekker med observeret=${idag}.`);
    console.log("Koer igen med --skriv for at udfoere.");
    return;
  }

  const BATCH = 500;
  for (let i = 0; i < varer.length; i += BATCH) {
    const batch = varer.slice(i, i + BATCH).map((v) => ({
      product_id: v.id,
      observeret: idag,
      price: v.price,
      price_original: v.price_original,
      in_stock: v.in_stock,
    }));
    const { error } = await sb
      .from("affiliate_price_history")
      .upsert(batch, { onConflict: "product_id,observeret", ignoreDuplicates: true });
    if (error) throw new Error(`Batch ${i}: ${error.message}`);
    console.log(`  skrevet ${Math.min(i + BATCH, varer.length)}/${varer.length}`);
  }

  const { count: efter } = await sb
    .from("affiliate_price_history")
    .select("*", { count: "exact", head: true });
  console.log(`prishistorik efter: ${efter ?? 0} raekker (+${(efter ?? 0) - (foer ?? 0)})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
