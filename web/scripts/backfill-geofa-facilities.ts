/**
 * Backfill geofa_raw with facility data extracted from descriptions.
 *
 * This updates the geofa_raw JSONB field on shelters to include structured
 * facility data (baalplads, hunde_tilladt) so that existing search filters work.
 * Only sets values that are currently null/missing in geofa_raw.
 *
 * Usage:
 *   cd web && npx tsx scripts/backfill-geofa-facilities.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or key");
  process.exit(1);
}

const supabase = createClient(url, key);

interface KeywordRule {
  geofa_key: string;
  patterns: RegExp[];
  negations?: RegExp[];
  value: string;
}

const RULES: KeywordRule[] = [
  {
    geofa_key: "baalplads",
    patterns: [/bålplads/i, /\bbål\w*/i, /baalplads/i, /lejrbål/i, /bålsted/i],
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
    value: "Ja",
  },
  {
    geofa_key: "hunde_tilladt",
    patterns: [/hunde?\s*tilladt/i, /hundevenlig/i, /medbring.*hund/i],
    negations: [
      /hunde?\s*(er\s+)?ikke\s*tilladt/i,
      /ingen\s+hund/i, /ikke\s+hund/i,
      /hunde?\s*forbudt/i, /hunde?\s*må\s+ikke/i,
      /hundeskov/i,
    ],
    value: "Ja",
  },
  {
    geofa_key: "bord_baenk",
    patterns: [
      /bord[\s/,-]?bænk/i, /bænk[\s/,-]?bord/i,
      /borde[\s/,-]+bænke/i, /bænke[\s/,-]+borde/i,
      /borde\s+og\s+bænke/i, /bænke\s+og\s+borde/i,
      /bordebænke/i, /bænkeborde/i,
      /borde-bænke/i, /bænke-borde/i,
      /picnicbord/i, /bænksæt/i,
      /bordebænkesæt/i, /borde-bænkesæt/i,
    ],
    negations: [
      /ingen\s+bord/i, /ikke\s+bord/i,
      /ingen\s+bænk/i, /ikke\s+bænk/i,
    ],
    value: "Ja",
  },
  {
    geofa_key: "strand_naerhed",
    patterns: [/\bstrand\b/i, /\bbadestrand/i, /\bstrandkant/i, /\bstrandeng/i, /nær\s+strand/i, /tæt\s+på\s+strand/i],
    negations: [
      /ingen\s+strand/i, /langt\s+fra\s+strand/i,
    ],
    value: "Ja",
  },
  {
    geofa_key: "bruser_bad",
    patterns: [/\bbruser/i, /\bbrusebad/i, /\bbaderum/i, /bad\s*og\s*toilet/i, /toilet\s*og\s*bad/i, /\bbadeforhold/i],
    negations: [
      /ingen\s+bruser/i, /ikke\s+bruser/i,
      /ingen\s+(adgang\s+til\s+)?bad\b/i,
      /ikke\s+(adgang\s+til\s+)?bad\b/i,
    ],
    value: "Ja",
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
      .select("id, slug, description, geofa_raw")
      .is("duplicate_of_shelter_id", null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) { console.error("Error:", error); process.exit(1); }
    if (!data || data.length === 0) break;
    allShelters = allShelters.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`Found ${allShelters.length} shelters. Scanning...`);

  let updatedCount = 0;

  for (const shelter of allShelters) {
    const raw = (shelter.geofa_raw || {}) as Record<string, unknown>;

    // Build text corpus — scan description + ALL string fields in geofa_raw
    const textParts: string[] = [];
    if (shelter.description) textParts.push(String(shelter.description));
    for (const [key, v] of Object.entries(raw)) {
      if (typeof v === "string" && v.length > 15) textParts.push(v);
    }
    const fullText = textParts.join(" ");
    if (!fullText.trim()) continue;

    const updates: Record<string, string> = {};

    for (const rule of RULES) {
      // Skip if geofa_raw already has this field
      const existing = raw[rule.geofa_key];
      if (existing != null && String(existing).trim() !== "") continue;

      // Check negations first
      if (rule.negations?.some((neg) => neg.test(fullText))) continue;

      for (const pattern of rule.patterns) {
        if (pattern.test(fullText)) {
          updates[rule.geofa_key] = rule.value;
          break;
        }
      }
    }

    if (Object.keys(updates).length === 0) continue;

    // Merge into geofa_raw
    const newRaw = { ...raw, ...updates };
    const { error } = await supabase
      .from("shelters")
      .update({ geofa_raw: newRaw })
      .eq("id", shelter.id);

    if (error) {
      console.error(`Error updating ${shelter.slug}:`, error.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`Done! Updated ${updatedCount} shelters with extracted facility data.`);
}

main().catch(console.error);
