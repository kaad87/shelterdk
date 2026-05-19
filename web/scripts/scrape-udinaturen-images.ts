/**
 * Scrape shelter images from udinaturen.dk for shelters missing image_url.
 *
 * For each shelter with geofa_raw.objekt_id but no image_url, fetches the
 * udinaturen.dk facility page and extracts the image UUID from the routePoints
 * JavaScript variable, then updates image_url in Supabase.
 *
 * Usage:
 *   cd web && npx tsx scripts/scrape-udinaturen-images.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or key");
  process.exit(1);
}

const supabase = createClient(url, key);

const BATCH_SIZE = 1000;
const REQUEST_DELAY_MS = 500;
const IMAGE_BASE_URL =
  "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600";

function normalizeImageUrl(imageValue: string): string | null {
  const value = imageValue.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (
        url.hostname === "mapcentia-www.s3-eu-west-1.amazonaws.com" &&
        /^\/fkg\/\d+\//.test(url.pathname)
      ) {
        url.pathname = url.pathname.replace(/^\/fkg\/\d+\//, "/fkg/1600/");
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  return `${IMAGE_BASE_URL}/${value}.jpg`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract image UUID and facility name from the udinaturen.dk page HTML.
 * Looks for the routePoints JS variable and pulls the "image" and "name" fields.
 */
function extractImageData(html: string): { imageUuid: string; pageName: string } | null {
  const routePointsMatch = html.match(
    /var\s+routePoints\s*=\s*(\[[\s\S]*?\]);/
  );
  if (!routePointsMatch) return null;

  try {
    const routePoints = JSON.parse(routePointsMatch[1]);
    if (Array.isArray(routePoints) && routePoints.length > 0) {
      const image = routePoints[0]?.image;
      const pageName = routePoints[0]?.name || "";
      if (typeof image === "string" && image.trim().length > 0) {
        return { imageUuid: image.trim(), pageName: String(pageName) };
      }
    }
  } catch {
    // JSON parse failed — page format may differ
  }

  return null;
}

/**
 * Simple name similarity check to verify the udinaturen page matches our shelter.
 * Returns true if at least one significant word (3+ chars) overlaps.
 */
function namesMatch(ourTitle: string, theirName: string): boolean {
  if (!ourTitle || !theirName) return true; // skip check if no name to compare
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zæøå0-9\s]/g, "").trim();
  const ourWords = normalize(ourTitle).split(/\s+/).filter(w => w.length >= 3);
  const theirWords = normalize(theirName).split(/\s+/).filter(w => w.length >= 3);
  return ourWords.some(w => theirWords.includes(w));
}

async function fetchAllSheltersWithoutImage() {
  const allShelters: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, title, geofa_raw")
      .is("image_url", null)
      .not("geofa_raw->objekt_id", "is", null)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase fetch error:", error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allShelters.push(...data);
    console.log(`  Fetched batch: ${data.length} shelters (total: ${allShelters.length})`);

    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return allShelters;
}

async function main() {
  console.log("Fetching shelters with no image_url and a geofa_raw.objekt_id...");
  const shelters = await fetchAllSheltersWithoutImage();
  console.log(`Found ${shelters.length} shelters to process.\n`);

  if (shelters.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let mismatches = 0;

  for (let i = 0; i < shelters.length; i++) {
    const shelter = shelters[i];
    const objektId: string | undefined = shelter.geofa_raw?.objekt_id;

    if (!objektId) {
      skipped++;
      continue;
    }

    const upperId = objektId.toUpperCase();
    const pageUrl = `https://udinaturen.dk/facilitet/shelter/?id=${upperId}`;

    try {
      const resp = await fetch(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ShelterDK-ImageScraper/1.0)",
        },
      });

      if (!resp.ok) {
        errors++;
        if ((i + 1) % 10 === 0 || i === 0)
          console.log(`[${i + 1}/${shelters.length}] HTTP ${resp.status} for ${shelter.title}`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const html = await resp.text();
      const imageData = extractImageData(html);

      if (!imageData) {
        skipped++;
        if ((i + 1) % 10 === 0)
          console.log(`[${i + 1}/${shelters.length}] No image found for "${shelter.title}"`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      // Safety check: verify the udinaturen page name matches our shelter title
      if (!namesMatch(shelter.title, imageData.pageName)) {
        mismatches++;
        console.log(
          `[${i + 1}/${shelters.length}] NAME MISMATCH — ours: "${shelter.title}" vs theirs: "${imageData.pageName}" — skipping`
        );
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const imageUrl = normalizeImageUrl(imageData.imageUuid);
      if (!imageUrl) {
        skipped++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const { error: updateError } = await supabase
        .from("shelters")
        .update({ image_url: imageUrl })
        .eq("id", shelter.id);

      if (updateError) {
        console.error(`  Update error for "${shelter.title}":`, updateError.message);
        errors++;
      } else {
        updated++;
      }
    } catch (err: any) {
      errors++;
      console.error(`  Fetch error for "${shelter.title}":`, err.message);
    }

    if ((i + 1) % 10 === 0) {
      console.log(
        `[${i + 1}/${shelters.length}] Progress — updated: ${updated}, skipped: ${skipped}, mismatches: ${mismatches}, errors: ${errors}`
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("\n=== Done ===");
  console.log(`Total shelters processed: ${shelters.length}`);
  console.log(`Updated with image:       ${updated}`);
  console.log(`Skipped (no image):       ${skipped}`);
  console.log(`Name mismatches:          ${mismatches}`);
  console.log(`Errors:                   ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
