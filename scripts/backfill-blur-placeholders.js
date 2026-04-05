#!/usr/bin/env node
/**
 * Backfill blur_data_url for all shelters that don't have one yet.
 *
 * Usage:
 *   node scripts/backfill-blur-placeholders.js
 *   node scripts/backfill-blur-placeholders.js --dry-run
 *   node scripts/backfill-blur-placeholders.js --limit 50
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars.
 * Uses sharp for image processing (installed in web/).
 */

const { createClient } = require("@supabase/supabase-js");

const CONCURRENCY = 5;
const BLUR_WIDTH = 16;
const BLUR_SIGMA = 5;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sharp = (await import("sharp")).default;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch shelters without blur
  let query = supabase
    .from("shelters")
    .select("id, slug, image_url, image_urls, user_image_urls")
    .is("blur_data_url", null)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false, nullsFirst: false });

  if (limit) query = query.limit(limit);

  const { data: shelters, error } = await query;
  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${shelters.length} shelters without blur_data_url`);
  if (dryRun) {
    console.log("Dry run — not updating anything");
    return;
  }

  let success = 0;
  let skipped = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < shelters.length; i += CONCURRENCY) {
    const batch = shelters.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (shelter) => {
      try {
        // Find first image URL
        const urls = [
          shelter.image_url,
          ...(shelter.image_urls || []),
          ...(shelter.user_image_urls || []),
        ].filter((u) => u && typeof u === "string" && u.trim().length > 10);

        if (urls.length === 0) {
          skipped++;
          return;
        }

        const imageUrl = urls[0];
        const fetchUrl = imageUrl.startsWith("http")
          ? imageUrl
          : `${supabaseUrl}${imageUrl}`;

        const res = await fetch(fetchUrl, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          console.warn(`  [SKIP] ${shelter.slug}: HTTP ${res.status}`);
          skipped++;
          return;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        const blurBuf = await sharp(buf, { failOnError: false })
          .rotate()
          .resize(BLUR_WIDTH)
          .blur(BLUR_SIGMA)
          .jpeg({ quality: 60 })
          .toBuffer();

        const dataUrl = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;

        const { error: updateErr } = await supabase
          .from("shelters")
          .update({ blur_data_url: dataUrl })
          .eq("id", shelter.id);

        if (updateErr) {
          console.warn(`  [ERR] ${shelter.slug}: ${updateErr.message}`);
          skipped++;
        } else {
          success++;
          if (success % 25 === 0) console.log(`  Progress: ${success} done`);
        }
      } catch (err) {
        console.warn(`  [SKIP] ${shelter.slug}: ${err.message}`);
        skipped++;
      }
    }));
  }

  console.log(`\nDone: ${success} updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
