/**
 * One-time script: auto-maps raw affiliate categories to internal slugs
 * based on keyword matching, and whitelists relevant outdoor categories.
 *
 * Run: cd web && npx tsx scripts/auto-map-categories.ts
 */

try {
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv not available — production env vars assumed */
}
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Order matters: first match wins. Patterns are matched against lowercased raw string.
const RULES: { pattern: RegExp; slug: string }[] = [
  // Telte
  { pattern: /telt/i, slug: "telt" },
  { pattern: /tipi/i, slug: "telt" },
  { pattern: /bivuak/i, slug: "telt" },
  { pattern: /tarp/i, slug: "tarp" },

  // Sove
  { pattern: /sovepose/i, slug: "sovepose" },
  { pattern: /sovesæk/i, slug: "sovepose" },
  { pattern: /liggeunderlag/i, slug: "liggeunderlag" },
  { pattern: /madras/i, slug: "liggeunderlag" },
  { pattern: /soveudstyr/i, slug: "soveudstyr" },
  { pattern: /hængekøje/i, slug: "haengekoje" },
  { pattern: /hammock/i, slug: "haengekoje" },

  // Rygsække & tasker
  { pattern: /rygsæk/i, slug: "rygsaek" },
  { pattern: /rygsaek/i, slug: "rygsaek" },
  { pattern: /backpack/i, slug: "rygsaek" },
  { pattern: /dagstur/i, slug: "rygsaek" },
  { pattern: /duffel/i, slug: "taske" },
  { pattern: /taske/i, slug: "taske" },
  { pattern: /paktaske/i, slug: "taske" },
  { pattern: /drybag/i, slug: "taske" },
  { pattern: /dry bag/i, slug: "taske" },

  // Lys
  { pattern: /pandelampe/i, slug: "pandelampe" },
  { pattern: /headlamp/i, slug: "pandelampe" },
  { pattern: /lommelygte/i, slug: "lygte" },
  { pattern: /lanterne/i, slug: "lygte" },
  { pattern: /lygte/i, slug: "lygte" },

  // Køkken & mad
  { pattern: /gasbrænder/i, slug: "kogeudstyr" },
  { pattern: /gasbraender/i, slug: "kogeudstyr" },
  { pattern: /brænder/i, slug: "kogeudstyr" },
  { pattern: /koger/i, slug: "kogeudstyr" },
  { pattern: /stormkøkken/i, slug: "kogeudstyr" },
  { pattern: /primus/i, slug: "kogeudstyr" },
  { pattern: /gryde/i, slug: "kogeudstyr" },
  { pattern: /pande\b/i, slug: "kogeudstyr" },
  { pattern: /kogeset/i, slug: "kogeudstyr" },
  { pattern: /bestik/i, slug: "kogeudstyr" },
  { pattern: /thermos/i, slug: "drikkedunk" },
  { pattern: /termokande/i, slug: "drikkedunk" },
  { pattern: /drikkedunk/i, slug: "drikkedunk" },
  { pattern: /vandflaske/i, slug: "drikkedunk" },
  { pattern: /vandfilter/i, slug: "vandfilter" },
  { pattern: /køkken/i, slug: "kogeudstyr" },
  { pattern: /madopbevaring/i, slug: "kogeudstyr" },
  { pattern: /køleboks/i, slug: "kogeudstyr" },
  { pattern: /køleelement/i, slug: "kogeudstyr" },

  // Beklædning
  { pattern: /regntøj/i, slug: "regntoj" },
  { pattern: /regnjakke/i, slug: "regntoj" },
  { pattern: /regnbuks/i, slug: "regntoj" },
  { pattern: /skaljakke/i, slug: "regntoj" },
  { pattern: /poncho/i, slug: "regntoj" },
  { pattern: /dunjakke/i, slug: "jakke" },
  { pattern: /fleecejakke/i, slug: "jakke" },
  { pattern: /softshell/i, slug: "jakke" },
  { pattern: /vinterjakke/i, slug: "jakke" },
  { pattern: /jakke/i, slug: "jakke" },
  { pattern: /buks/i, slug: "bukser" },
  { pattern: /shorts/i, slug: "bukser" },
  { pattern: /vandresko/i, slug: "fodtoj" },
  { pattern: /støvle/i, slug: "fodtoj" },
  { pattern: /sandal/i, slug: "fodtoj" },
  { pattern: /sko\b/i, slug: "fodtoj" },
  { pattern: /gummistøvle/i, slug: "fodtoj" },
  { pattern: /sokker/i, slug: "sokker" },
  { pattern: /handske/i, slug: "beklædning" },
  { pattern: /hue\b/i, slug: "beklædning" },
  { pattern: /buff\b/i, slug: "beklædning" },
  { pattern: /kasket/i, slug: "beklædning" },
  { pattern: /solhat/i, slug: "beklædning" },
  { pattern: /t-shirt/i, slug: "beklædning" },
  { pattern: /trøje/i, slug: "beklædning" },
  { pattern: /fleece/i, slug: "beklædning" },
  { pattern: /undertøj/i, slug: "beklædning" },
  { pattern: /merinould/i, slug: "beklædning" },
  { pattern: /baselayer/i, slug: "beklædning" },
  { pattern: /base layer/i, slug: "beklædning" },
  { pattern: /beklædning/i, slug: "beklædning" },
  { pattern: /tøj/i, slug: "beklædning" },

  // Navigation & elektronik
  { pattern: /kompas/i, slug: "navigation" },
  { pattern: /gps/i, slug: "navigation" },
  { pattern: /kort\b/i, slug: "navigation" },
  { pattern: /powerbank/i, slug: "elektronik" },
  { pattern: /solcelle/i, slug: "elektronik" },
  { pattern: /solar/i, slug: "elektronik" },
  { pattern: /radio/i, slug: "elektronik" },
  { pattern: /ur\b/i, slug: "elektronik" },

  // Knive & værktøj
  { pattern: /kniv/i, slug: "kniv" },
  { pattern: /multiværktøj/i, slug: "kniv" },
  { pattern: /multitool/i, slug: "kniv" },
  { pattern: /økse/i, slug: "kniv" },
  { pattern: /sav\b/i, slug: "kniv" },

  // Hygiejne & førstehjælp
  { pattern: /førstehjælp/i, slug: "foerstehjaelp" },
  { pattern: /first aid/i, slug: "foerstehjaelp" },
  { pattern: /hygiejne/i, slug: "hygiejne" },
  { pattern: /håndklæde/i, slug: "hygiejne" },
  { pattern: /sæbe/i, slug: "hygiejne" },
  { pattern: /toiletpapir/i, slug: "hygiejne" },
  { pattern: /insektmiddel/i, slug: "hygiejne" },
  { pattern: /myggenet/i, slug: "hygiejne" },
  { pattern: /myggespray/i, slug: "hygiejne" },
  { pattern: /insektbeskyttelse/i, slug: "hygiejne" },

  // Møbler & komfort
  { pattern: /campingstol/i, slug: "campingmobler" },
  { pattern: /stol\b/i, slug: "campingmobler" },
  { pattern: /campingbord/i, slug: "campingmobler" },
  { pattern: /bord\b/i, slug: "campingmobler" },
  { pattern: /campingmøb/i, slug: "campingmobler" },
  { pattern: /pude/i, slug: "campingmobler" },
  { pattern: /rejsepude/i, slug: "campingmobler" },

  // Vandaktiviteter
  { pattern: /kajak/i, slug: "vand" },
  { pattern: /kano/i, slug: "vand" },
  { pattern: /sup\b/i, slug: "vand" },
  { pattern: /paddle/i, slug: "vand" },
  { pattern: /redningsvest/i, slug: "vand" },
  { pattern: /svømme/i, slug: "vand" },

  // Cykel
  { pattern: /cykel/i, slug: "cykel" },
  { pattern: /bike/i, slug: "cykel" },

  // Klatring
  { pattern: /klatr/i, slug: "klatring" },
  { pattern: /sele\b/i, slug: "klatring" },
  { pattern: /karabin/i, slug: "klatring" },

  // Fiskeri
  { pattern: /fiskeri/i, slug: "fiskeri" },
  { pattern: /fiske/i, slug: "fiskeri" },
  { pattern: /lystfisk/i, slug: "fiskeri" },

  // Jagt
  { pattern: /jagt/i, slug: "jagt" },
  { pattern: /kikkert/i, slug: "kikkert" },

  // Prepping / survival
  { pattern: /prepping/i, slug: "prepping" },
  { pattern: /survival/i, slug: "prepping" },
  { pattern: /nødforsyning/i, slug: "prepping" },
  { pattern: /beredskab/i, slug: "prepping" },

  // Hund
  { pattern: /hund/i, slug: "hund" },

  // Børn
  { pattern: /børn/i, slug: "boern" },
  { pattern: /barn/i, slug: "boern" },
  { pattern: /junior/i, slug: "boern" },
  { pattern: /kids/i, slug: "boern" },

  // Gaveideer (catch-all for gift categories)
  { pattern: /gaveid/i, slug: "gave" },

  // Tilbehør (catch-all)
  { pattern: /tilbehør/i, slug: "tilbehoer" },
  { pattern: /accessories/i, slug: "tilbehoer" },
  { pattern: /reservedel/i, slug: "tilbehoer" },
];

// Categories to whitelist (outdoor-relevant for /tilbud)
const WHITELISTED_SLUGS = new Set([
  "telt",
  "tarp",
  "sovepose",
  "liggeunderlag",
  "soveudstyr",
  "haengekoje",
  "rygsaek",
  "pandelampe",
  "lygte",
  "kogeudstyr",
  "drikkedunk",
  "vandfilter",
  "regntoj",
  "jakke",
  "fodtoj",
  "kniv",
  "foerstehjaelp",
  "campingmobler",
  "kikkert",
  "taske",
]);

function matchCategory(raw: string): string | null {
  const lower = raw.toLowerCase();
  for (const rule of RULES) {
    if (rule.pattern.test(lower)) return rule.slug;
  }
  return null;
}

async function main() {
  const { data, error } = await supabase
    .from("affiliate_category_mapping")
    .select("retailer, category_raw, category_mapped, whitelisted");

  if (error) {
    console.error("Failed to fetch categories:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`Found ${rows.length} category rows`);

  let mapped = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const row of rows) {
    // Skip rows that already have a mapping
    if (row.category_mapped) {
      skipped++;
      continue;
    }

    const slug = matchCategory(row.category_raw);
    if (!slug) {
      unmapped++;
      continue;
    }

    const whitelisted = WHITELISTED_SLUGS.has(slug);
    const { error: updateError } = await supabase
      .from("affiliate_category_mapping")
      .update({
        category_mapped: slug,
        whitelisted,
        updated_at: new Date().toISOString(),
      })
      .eq("retailer", row.retailer)
      .eq("category_raw", row.category_raw);

    if (updateError) {
      console.error(`  ✗ ${row.retailer}::${row.category_raw}: ${updateError.message}`);
    } else {
      mapped++;
      console.log(`  ✓ ${row.category_raw} → ${slug}${whitelisted ? " [whitelisted]" : ""}`);
    }
  }

  console.log(`\nDone: ${mapped} mapped, ${skipped} already had mapping, ${unmapped} unmatched`);

  if (unmapped > 0) {
    console.log("\nUnmatched categories:");
    for (const row of rows) {
      if (!row.category_mapped && !matchCategory(row.category_raw)) {
        console.log(`  - [${row.retailer}] ${row.category_raw}`);
      }
    }
  }
}

main();
