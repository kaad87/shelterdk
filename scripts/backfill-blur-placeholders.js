#!/usr/bin/env node
/**
 * Backfill blur_data_url for all shelters that don't have one yet.
 *
 * Usage:
 *   node scripts/backfill-blur-placeholders.js
 *   node scripts/backfill-blur-placeholders.js --dry-run
 *   node scripts/backfill-blur-placeholders.js --limit 50
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY env vars.
 * Uses sharp for image processing (installed in web/).
 */

const path = require("path");
const https = require("https");
const http = require("http");
const { createClient } = require("@supabase/supabase-js");

const CONCURRENCY = 5;
const BLUR_WIDTH = 16;
const BLUR_SIGMA = 5;
const GOOGLE_PHOTO_API = "https://maps.googleapis.com/maps/api/place/photo";
const GOOGLE_DETAILS_API = "https://maps.googleapis.com/maps/api/place/details/json";

/** Fetch image buffer via Node http/https */
function fetchImage(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    let req;
    const timer = setTimeout(() => { if (req) req.destroy(); reject(new Error("Timeout")); }, timeoutMs);
    req = mod.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*,*/*;q=0.8",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return fetchImage(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      res.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

/** Fetch a Google Places photo via the Places API (requires API key). */
async function fetchGooglePlacePhoto(placeId, apiKey) {
  // Step 1: Get photo_reference from Places Details API
  const detailUrl = `${GOOGLE_DETAILS_API}?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`;
  const detailRes = await fetch(detailUrl);
  const detail = await detailRes.json();
  if (detail.status !== "OK" || !detail.result?.photos?.length) {
    throw new Error(`No photos for place ${placeId}: ${detail.status}`);
  }
  const ref = detail.result.photos[0].photo_reference;

  // Step 2: Fetch actual photo via Places Photo API (small size for blur)
  const photoUrl = `${GOOGLE_PHOTO_API}?photo_reference=${encodeURIComponent(ref)}&maxwidth=400&key=${apiKey}`;
  const photoRes = await fetch(photoUrl, { redirect: "follow" });
  if (!photoRes.ok) throw new Error(`Google Photo API ${photoRes.status}`);
  return Buffer.from(await photoRes.arrayBuffer());
}

function isGoogleImageUrl(url) {
  return url.includes("googleusercontent.com") || url.includes("googleapis.com");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!googleApiKey) {
    console.warn("Warning: No GOOGLE_MAPS_API_KEY — Google Places photos will be skipped");
  }

  const sharp = require(path.join(__dirname, "..", "web", "node_modules", "sharp"));
  const supabase = createClient(supabaseUrl, serviceKey);

  const PAGE_SIZE = 1000;
  let success = 0;
  let skipped = 0;
  let googleFetched = 0;
  let directFetched = 0;

  // First, get total count
  const { count: totalRemaining } = await supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("blur_data_url", null)
    .is("duplicate_of_shelter_id", null);

  const toProcess = limit ? Math.min(limit, totalRemaining) : totalRemaining;
  console.log(`Found ${totalRemaining} shelters without blur_data_url (processing ${toProcess})`);

  if (dryRun) {
    console.log("Dry run — not updating anything");
    return;
  }

  // Paginate with range() to handle >1000 shelters and avoid infinite loops
  // on shelters that can't be processed (skipped shelters stay blur_data_url=null)
  for (let offset = 0; offset < toProcess; offset += PAGE_SIZE) {
    const end = Math.min(offset + PAGE_SIZE - 1, toProcess - 1);
    const { data: shelters, error } = await supabase
      .from("shelters")
      .select("id, slug, image_url, image_urls, user_image_urls, google_place_id")
      .is("blur_data_url", null)
      .is("duplicate_of_shelter_id", null)
      .order("display_score", { ascending: false, nullsFirst: false })
      .range(0, PAGE_SIZE - 1);
      // Always fetch from 0: successfully processed rows disappear from the result
      // because their blur_data_url is no longer null.

    if (error) {
      console.error("Query error:", error.message);
      process.exit(1);
    }
    if (shelters.length === 0) break;

    console.log(`Page ${Math.floor(offset / PAGE_SIZE) + 1}: ${shelters.length} shelters`);
    let pageSuccess = 0;

    // Process in batches of CONCURRENCY
    for (let i = 0; i < shelters.length; i += CONCURRENCY) {
      const batch = shelters.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (shelter) => {
        try {
          const urls = [
            shelter.image_url,
            ...(shelter.image_urls || []),
            ...(shelter.user_image_urls || []),
          ].filter((u) => u && typeof u === "string" && u.trim().length > 10);

          // Try direct (non-Google) URLs first
          const directUrl = urls.find(u => !isGoogleImageUrl(u));
          let buf = null;

          if (directUrl) {
            const fetchUrl = directUrl.startsWith("http")
              ? directUrl
              : `${supabaseUrl}${directUrl}`;
            try {
              buf = await fetchImage(fetchUrl);
              directFetched++;
            } catch (e) {
              // Fall through to Google Places
            }
          }

          // If no direct URL worked, try Google Places API
          if (!buf && shelter.google_place_id && googleApiKey) {
            try {
              buf = await fetchGooglePlacePhoto(shelter.google_place_id, googleApiKey);
              googleFetched++;
            } catch (e) {
              // No image available
            }
          }

          if (!buf) {
            skipped++;
            return;
          }

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
            pageSuccess++;
            if (success % 25 === 0) console.log(`  Progress: ${success} done (${googleFetched} via Google, ${directFetched} direct)`);
          }
        } catch (err) {
          console.warn(`  [SKIP] ${shelter.slug}: ${err.message}`);
          skipped++;
        }
      }));
    }

    // If no shelter was successfully updated this page, all remaining are unskippable — stop
    if (pageSuccess === 0) {
      console.log("No progress this page — remaining shelters have no usable images. Stopping.");
      break;
    }
  }

  console.log(`\nDone: ${success} updated, ${skipped} skipped (${googleFetched} via Google API, ${directFetched} direct)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
