/**
 * Scrape shelter images from bookenshelter.dk for shelters that:
 * 1. Have no image_url at all (get main image)
 * 2. Have only 1 image (add extra images to image_urls)
 *
 * Safety:
 * - Never overwrites existing image_url
 * - Only adds NEW images to image_urls (no duplicates)
 * - Verifies shelter name appears on bookenshelter page
 *
 * Usage:
 *   cd web && npx tsx scripts/scrape-bookenshelter-images.ts
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

const REQUEST_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract content image URLs from bookenshelter.dk HTML.
 * Picks wp-content/uploads images, preferring "-scaled" or largest resolution.
 * Excludes logos, payment icons, flags, etc.
 */
function extractContentImages(html: string): string[] {
  const imgRegex = /https?:\/\/bookenshelter\.dk\/[^"'\s]+\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
  const allMatches = Array.from(new Set(html.match(imgRegex) || []));

  // Group by base filename (strip resolution suffixes like -1024x661, -300x225, -scaled)
  const groups = new Map<string, string[]>();
  for (const url of allMatches) {
    const base = url
      .replace(/-\d+x\d+\.(jpg|jpeg|png|webp)$/i, ".$1")
      .replace(/-scaled\.(jpg|jpeg|png|webp)$/i, ".$1");
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(url);
  }

  // For each group, pick the best resolution (prefer -scaled, then largest dimensions)
  const bestImages: string[] = [];
  for (const [base, variants] of groups) {
    const scaled = variants.find((v) => v.includes("-scaled."));
    if (scaled) {
      bestImages.push(scaled);
      continue;
    }
    // Pick original (no dimensions suffix) or largest
    const original = variants.find((v) => v === base);
    if (original) {
      bestImages.push(original);
      continue;
    }
    // Sort by resolution (larger first)
    const withDims = variants
      .map((v) => {
        const m = v.match(/-(\d+)x(\d+)\./);
        return { url: v, pixels: m ? parseInt(m[1]) * parseInt(m[2]) : 0 };
      })
      .sort((a, b) => b.pixels - a.pixels);
    bestImages.push(withDims[0].url);
  }

  // Filter out common non-content images
  return bestImages.filter((url) => {
    const lower = url.toLowerCase();
    return (
      !lower.includes("logo") &&
      !lower.includes("nordeafonden") &&
      !lower.includes("friluftsra") &&
      !lower.includes("shoppingcart") &&
      !lower.includes("m-ramme-bookenshelter")
    );
  });
}

/**
 * Check that the bookenshelter page likely matches our shelter.
 * At least one significant word from our title should appear on the page.
 */
function pageMatchesShelter(html: string, ourTitle: string): boolean {
  if (!ourTitle) return true;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-zæøå0-9\s]/g, "").trim();
  const words = normalize(ourTitle)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !["shelter", "ved", "med", "shelterplads", "blåt", "støttepunkt"].includes(w));
  const pageText = normalize(html);
  return words.some((w) => pageText.includes(w));
}

async function main() {
  // Fetch all shelters with bookenshelter.dk/shelterplads/ booking URLs
  const { data: shelters, error } = await supabase
    .from("shelters")
    .select("id, title, slug, booking_url, image_url, image_urls")
    .like("booking_url", "%bookenshelter.dk%shelterplads%")
    .is("duplicate_of_shelter_id", null)
    .limit(500);

  if (error) {
    console.error("Supabase error:", error.message);
    return;
  }

  console.log(`Found ${shelters!.length} shelters with bookenshelter.dk URLs\n`);

  let newImages = 0;
  let extraImages = 0;
  let skipped = 0;
  let errors = 0;
  let nameMismatches = 0;

  for (let i = 0; i < shelters!.length; i++) {
    const s = shelters![i];
    const bookingUrl = s.booking_url?.trim();
    if (!bookingUrl || !bookingUrl.startsWith("http")) {
      skipped++;
      continue;
    }

    try {
      const resp = await fetch(bookingUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ShelterDK-ImageScraper/1.0)",
        },
      });

      if (!resp.ok) {
        console.log(`[${i + 1}] HTTP ${resp.status} for "${s.title}" → ${bookingUrl}`);
        errors++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const html = await resp.text();

      // Safety: verify the page matches our shelter
      if (!pageMatchesShelter(html, s.title)) {
        nameMismatches++;
        console.log(`[${i + 1}] NAME MISMATCH — "${s.title}" not found on page → skipping`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const images = extractContentImages(html);

      if (images.length === 0) {
        skipped++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      // Collect existing images to avoid duplicates
      const existingImages = new Set<string>();
      if (s.image_url) existingImages.add(s.image_url);
      if (s.image_urls) s.image_urls.forEach((u: string) => existingImages.add(u));

      const newUrls = images.filter((u) => !existingImages.has(u));

      if (newUrls.length === 0) {
        skipped++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      if (!s.image_url) {
        // No image at all — set first as main, rest as extras
        const update: any = { image_url: newUrls[0] };
        if (newUrls.length > 1) {
          update.image_urls = newUrls.slice(1);
        }
        const { error: upErr } = await supabase
          .from("shelters")
          .update(update)
          .eq("id", s.id);
        if (upErr) {
          console.error(`  Update error for "${s.title}":`, upErr.message);
          errors++;
        } else {
          newImages++;
          console.log(`[${i + 1}] NEW IMAGE for "${s.title}" (${newUrls.length} images)`);
        }
      } else {
        // Already has main image — add new ones to image_urls
        const currentExtras: string[] = s.image_urls || [];
        const merged = [...currentExtras, ...newUrls];
        const { error: upErr } = await supabase
          .from("shelters")
          .update({ image_urls: merged })
          .eq("id", s.id);
        if (upErr) {
          console.error(`  Update error for "${s.title}":`, upErr.message);
          errors++;
        } else {
          extraImages++;
          console.log(`[${i + 1}] +${newUrls.length} EXTRA images for "${s.title}"`);
        }
      }
    } catch (err: any) {
      errors++;
      console.error(`[${i + 1}] Fetch error for "${s.title}":`, err.message);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("\n=== Done ===");
  console.log(`Total processed:     ${shelters!.length}`);
  console.log(`New main images:     ${newImages}`);
  console.log(`Extra images added:  ${extraImages}`);
  console.log(`Skipped:             ${skipped}`);
  console.log(`Name mismatches:     ${nameMismatches}`);
  console.log(`Errors:              ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
