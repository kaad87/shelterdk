// scripts/generate-route-descriptions.ts
/**
 * Generate AI descriptions for curated routes using Claude API.
 * Reads curated-routes-index.json, generates descriptions for routes
 * that have empty descriptions, and writes back.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-route-descriptions.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY env var");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const indexPath = path.resolve(__dirname, "../public/data/curated-routes-index.json");
const fullPath = path.resolve(__dirname, "../public/data/curated-routes.json");

interface IndexEntry {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  length_km: number;
  shelter_count: number;
  bbox: number[];
}

interface FullEntry {
  geometry: any;
  shelters: { title: string }[];
}

async function generateDescription(
  route: IndexEntry,
  shelterNames: string[]
): Promise<string> {
  const topShelters = shelterNames.slice(0, 5).join(", ");

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Skriv en kort, inspirerende beskrivelse (2-3 sætninger, maks 400 tegn) af vandreruten "${route.name}" på dansk.
Ruten er ${route.length_km} km lang i ${route.region} og passerer ${route.shelter_count} shelters, bl.a. ${topShelters}.
Fokusér på naturoplevelsen og muligheden for overnatning i shelters. Skriv KUN beskrivelsen, intet andet.`,
      },
    ],
  });

  const text = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
  return text;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const index: IndexEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const full: Record<string, FullEntry> = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  const needsDescription = index.filter((r) => !r.description || r.description.trim().length === 0);
  console.log(`${needsDescription.length} routes need descriptions (${index.length} total)`);

  if (needsDescription.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let done = 0;
  let errors = 0;

  for (const route of needsDescription) {
    const fullEntry = full[route.slug];
    const shelterNames = fullEntry?.shelters?.map((s) => s.title) || [];

    try {
      const desc = await generateDescription(route, shelterNames);
      route.description = desc;
      done++;
      if (done % 10 === 0) {
        console.log(`[${done}/${needsDescription.length}] ${route.name}: ${desc.slice(0, 60)}...`);
      }
    } catch (err: any) {
      errors++;
      console.error(`Error for "${route.name}": ${err.message}`);
      // If rate limited, wait longer
      if (err.status === 429) {
        console.log("Rate limited, waiting 30s...");
        await sleep(30000);
      }
    }

    await sleep(200); // Be polite to the API
  }

  // Write back
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 0));
  console.log(`\n=== Done ===`);
  console.log(`Generated: ${done}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
