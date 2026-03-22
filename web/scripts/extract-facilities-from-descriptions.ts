/**
 * One-time script: Extract facility data from shelter descriptions and geofa_raw fields.
 *
 * Scans all shelters for keywords in description/geofa_raw and populates
 * shelter_community_facts with structured facility data.
 *
 * Usage:
 *   cd web && npx tsx scripts/extract-facilities-from-descriptions.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * (or use SUPABASE_SERVICE_ROLE_KEY for write access if anon doesn't have insert perms).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/.ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

type FacilityKey =
  | "baalplads"
  | "parkering"
  | "toilet"
  | "legeplads"
  | "fiskeri"
  | "vand"
  | "teltplads"
  | "hund"
  | "braende"
  | "bad";

interface KeywordRule {
  key: FacilityKey;
  patterns: RegExp[];
  /** Negation patterns — if any of these match, the facility is NOT present. */
  negations?: RegExp[];
  /** Only set if the official field for this facility is null. */
  officialField?: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    key: "baalplads",
    patterns: [/bålplads/i, /\bbål\b/i, /baalplads/i, /lejrbål/i, /bålsted/i],
    negations: [
      /ingen\s+bål/i, /ikke\s+bål\b/i, /bål\s*(er\s+)?forbudt/i,
      /bål\s*(er\s+)?ikke\s+tilladt/i,
      /der\s+er\s+ikke\s+(nogen\s+)?bålplads/i,
      /der\s+er\s+ingen\s+bålplads/i,
      /hverken\s+bålplads/i, /der\s+er\s+hverken.*bålplads/i,
      /uden\s+bålplads/i, /bålplads\s*:\s*nej/i,
      /ikke\s+toilet,?\s*(vandpost\s+)?eller\s+bålplads/i,
      /ikke\s+vandpost\s+eller\s+bålplads/i,
    ],
  },
  {
    key: "parkering",
    patterns: [/parkering/i, /p-plads/i, /parkeringsplads/i],
    negations: [
      /ingen\s+parkering/i, /ikke\s+parkering/i,
      /der\s+er\s+ikke\s+(nogen\s+)?parkering/i,
      /der\s+er\s+ingen\s+parkering/i,
      /parkering\s*(er\s+)?forbudt/i,
    ],
  },
  {
    key: "toilet",
    patterns: [/\btoilet\b/i, /\bwc\b/i, /muldtoilet/i, /toiletbygning/i, /das\b/i],
    negations: [
      /ingen\s+toilet/i, /ikke\s+toilet/i, /intet\s+toilet/i,
      /der\s+er\s+ikke\s+(nogen?\s+|noget\s+)?toilet/i,
      /der\s+er\s+ingen\s+toilet/i,
      /toilet\s*:\s*nej/i,
      /ikke\s+adgang\s+til\s+toilet/i,
      /uden\s+toilet/i,
    ],
    officialField: "toilet",
  },
  {
    key: "legeplads",
    patterns: [/legeplads/i],
  },
  {
    key: "fiskeri",
    patterns: [/fiskeri/i, /\bfiske\b/i, /lystfisk/i, /fiskeplads/i],
    negations: [
      /fiskeri\s*(er\s+)?forbudt/i,
      /ikke\s+tilladt\s+at\s+fiske/i,
    ],
  },
  {
    key: "vand",
    patterns: [/drikkevand/i, /vandhane/i, /vandpost/i],
    negations: [
      /ingen\s+(adgang\s+til\s+)?drikkevand/i,
      /ikke\s+(adgang\s+til\s+)?drikkevand/i,
      /intet\s+drikkevand/i,
      /der\s+er\s+ikke\s+(nogen\s+)?vandhane/i,
      /der\s+er\s+ingen\s+vandhane/i,
      /ingen\s+vandpost/i, /der\s+er\s+ikke\s+(nogen\s+)?vandpost/i,
      /ikke\s+adgang\s+til\s+vand/i, /ingen\s+adgang\s+til\s+vand/i,
      /der\s+er\s+ikke\s+vand\b/i,
      /drikkevand\s*:\s*nej/i,
      /uden\s+(adgang\s+til\s+)?(drikke)?vand/i,
    ],
    officialField: "water",
  },
  {
    key: "teltplads",
    patterns: [/teltplads/i, /\btelt\b/i, /teltning/i],
    negations: [
      /ingen\s+telt/i, /ikke\s+telt/i,
      /telt\s*(er\s+)?forbudt/i, /teltning\s*(er\s+)?forbudt/i,
      /teltning\s*(er\s+)?ikke\s+tilladt/i,
      /telt\s*(er\s+)?ikke\s+tilladt/i,
      /der\s+må\s+ikke.*telt/i,
      /ikke\s+tilladt\s+(at\s+)?slå\s+telt/i,
      /ikke\s+opstilles\s+telt/i,
      /forbudt\s+at\s+(ligge|sove)\s+i\s+telt/i,
      /må\s+ikke.*telt/i,
    ],
  },
  {
    key: "hund",
    patterns: [/hunde?\s*tilladt/i, /hundevenlig/i, /medbring.*hund/i],
    negations: [
      /hunde?\s*(er\s+)?ikke\s*tilladt/i,
      /ingen\s+hund/i, /ikke\s+hund/i,
      /hunde?\s*forbudt/i, /hunde?\s*må\s+ikke/i,
      /hundeskov/i,  // "hundeskov" i nærheden ≠ hund tilladt ved shelteret
    ],
  },
  {
    key: "braende",
    patterns: [/brænde/i, /brende/i, /brændestabel/i],
    negations: [
      /ingen\s+brænde/i, /ikke\s+brænde\b/i,
      /der\s+lægges\s+ikke\s+brænde/i,
      /medbring\s+(selv\s+)?brænde/i,
      /selv\s+medbringe\s+brænde/i,
      /brænde\s+skal\s+medbringes/i,
      /brænde\s+med\s+selv/i,
      /tag\s+(selv\s+|lidt\s+)?brænde\s+med/i,
      /brænde\s+skal\s+selv/i,
    ],
  },
  {
    key: "bad",
    patterns: [/\bbruser/i, /\bbrusebad/i, /\bbaderum/i, /bad\s*og\s*toilet/i, /toilet\s*og\s*bad/i, /\bbadeforhold/i],
    negations: [
      /ingen\s+bruser/i, /ikke\s+bruser/i,
      /ingen\s+(adgang\s+til\s+)?bad\b/i,
      /ikke\s+(adgang\s+til\s+)?bad\b/i,
    ],
  },
];

async function main() {
  console.log("Fetching all shelters...");

  const PAGE_SIZE = 1000;
  let allShelters: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, slug, description, geofa_raw, water, toilet")
      .is("duplicate_of_shelter_id", null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching shelters:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allShelters = allShelters.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`Found ${allShelters.length} shelters. Scanning descriptions...`);

  // Get existing community facts to avoid overwriting
  const { data: existingFacts } = await supabase
    .from("shelter_community_facts")
    .select("shelter_id");

  const existingIds = new Set(
    (existingFacts ?? []).map((r: { shelter_id: number }) => r.shelter_id)
  );

  let extractedCount = 0;
  let skippedCount = 0;
  const toUpsert: { shelter_id: number; [key: string]: string | number }[] = [];

  for (const shelter of allShelters) {
    const raw = (shelter.geofa_raw || {}) as Record<string, unknown>;
    // Build text corpus from all description-like fields
    const textParts: string[] = [];
    if (shelter.description) textParts.push(String(shelter.description));
    for (const key of ["lang_beskr", "lang_besk", "d_k_beskr", "beskrivels", "facilitet"]) {
      const v = raw[key];
      if (typeof v === "string" && v.trim()) textParts.push(v);
    }
    // Also check geofa_raw baalplads, vandhane, hunde_tilladt for structured data
    const geoText = [
      raw.baalplads,
      raw.vandhane,
      raw.hunde_tilladt,
      raw.facilitet,
    ]
      .filter((v) => typeof v === "string")
      .join(" ");
    if (geoText) textParts.push(geoText);

    const fullText = textParts.join(" ");
    if (!fullText.trim()) continue;

    const found: Partial<Record<FacilityKey, "yes">> = {};

    for (const rule of KEYWORD_RULES) {
      // Skip if this shelter already has official data for this facility
      if (rule.officialField) {
        const officialValue = shelter[rule.officialField];
        if (officialValue != null && officialValue !== "" && officialValue !== false) continue;
      }

      // Check negations first — if any negation matches, skip this rule
      if (rule.negations?.some((neg) => neg.test(fullText))) continue;

      for (const pattern of rule.patterns) {
        if (pattern.test(fullText)) {
          found[rule.key] = "yes";
          break;
        }
      }
    }

    if (Object.keys(found).length === 0) continue;

    // Skip if shelter already has community facts (don't overwrite user contributions)
    if (existingIds.has(shelter.id)) {
      skippedCount++;
      continue;
    }

    toUpsert.push({ shelter_id: shelter.id, ...found });
    extractedCount++;
  }

  console.log(`Extracted facilities for ${extractedCount} shelters (skipped ${skippedCount} with existing facts).`);

  if (toUpsert.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  // Batch upsert in chunks
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("shelter_community_facts")
      .upsert(batch, { onConflict: "shelter_id" });

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Done! Inserted ${inserted} rows into shelter_community_facts.`);

  // Summary of what was found
  const summary: Record<string, number> = {};
  for (const row of toUpsert) {
    for (const key of Object.keys(row)) {
      if (key === "shelter_id") continue;
      summary[key] = (summary[key] || 0) + 1;
    }
  }
  console.log("\nFacility breakdown:");
  for (const [key, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count} shelters`);
  }
}

main().catch(console.error);
