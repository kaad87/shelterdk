/**
 * One-time backfill: for all shelters with user_image_urls and no photo_order,
 * compute the initial photo_order using the same canonical source logic as getPhotoUrls().
 *
 * Usage (run once after deploying the migration):
 *   cd web && npx tsx scripts/backfill-photo-order.ts [--dry-run]
 *
 * --dry-run prints what would be written without modifying the database.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

const GEOFA_PHOTO_KEYS = [
  "foto_link", "foto_link1", "foto_link2", "foto_link3",
  "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3",
] as const;

function buildCanonicalOrder(row: {
  image_url: string | null;
  image_urls: string[] | null;
  user_image_urls: string[] | null;
  geofa_raw: Record<string, unknown> | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: unknown) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || !u.startsWith("http") || seen.has(u)) return;
    if (u.includes("cookiebot.com") || u.endsWith("/1.gif")) return;
    seen.add(u);
    out.push(u);
  };
  add(row.image_url);
  if (Array.isArray(row.image_urls)) row.image_urls.forEach(add);
  if (Array.isArray(row.user_image_urls)) row.user_image_urls.forEach(add);
  const raw = row.geofa_raw ?? {};
  for (const k of GEOFA_PHOTO_KEYS) add(raw[k]);
  return out;
}

async function main() {
  console.log(`🔍 Henter shelters med user_image_urls og ingen photo_order…${DRY_RUN ? " (DRY RUN)" : ""}`);

  const { data: shelters, error } = await supabase
    .from("shelters")
    .select("id, title, image_url, image_urls, user_image_urls, geofa_raw")
    .not("user_image_urls", "is", null)
    .is("photo_order", null);

  if (error) {
    console.error("❌ Fejl ved hentning:", error.message);
    process.exit(1);
  }

  const toBackfill = (shelters ?? []).filter(
    (s) => Array.isArray(s.user_image_urls) && (s.user_image_urls as string[]).length > 0
  );

  console.log(`   Fandt ${toBackfill.length} shelter(s) at backfill\n`);

  let updated = 0;
  let skipped = 0;

  for (const shelter of toBackfill) {
    const order = buildCanonicalOrder({
      image_url: shelter.image_url as string | null,
      image_urls: shelter.image_urls as string[] | null,
      user_image_urls: shelter.user_image_urls as string[] | null,
      geofa_raw: shelter.geofa_raw as Record<string, unknown> | null,
    });

    if (order.length === 0) {
      console.log(`⏭  Springer over ${shelter.id} — ingen gyldige URL'er`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`🔍 [DRY] ${shelter.id}: ${order.length} billeder → [${order.slice(0, 2).join(", ")}${order.length > 2 ? "…" : ""}]`);
      updated++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("shelters")
      .update({ photo_order: order })
      .eq("id", shelter.id);

    if (updateErr) {
      console.error(`❌ Fejl ved opdatering af ${shelter.id}:`, updateErr.message);
    } else {
      console.log(`✅ ${shelter.title} (${shelter.id}): ${order.length} billeder`);
      updated++;
    }
  }

  console.log(`\n🎉 Færdig! ${updated} opdateret, ${skipped} sprunget over.`);
}

main().catch((err) => {
  console.error("Uventet fejl:", err);
  process.exit(1);
});
