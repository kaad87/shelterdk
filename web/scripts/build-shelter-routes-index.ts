/**
 * Build a reverse index: shelter slug → routes that include it.
 * Reads curated-routes.json + curated-routes-index.json and writes
 * public/data/shelter-routes-index.json.
 *
 * Run: npx tsx scripts/build-shelter-routes-index.ts
 */

import fs from "node:fs";
import path from "node:path";

interface RouteShelter {
  slug: string;
  distance_to_trail_km: number;
}

interface RouteData {
  shelters: RouteShelter[];
}

interface RouteIndex {
  slug: string;
  name: string;
  length_km: number;
  region: string;
}

interface ReverseEntry {
  slug: string;
  name: string;
  length_km: number;
  region: string;
  distance_km: number;
}

const dataDir = path.join(process.cwd(), "public/data");

const routesData: Record<string, RouteData> = JSON.parse(
  fs.readFileSync(path.join(dataDir, "curated-routes.json"), "utf-8")
);
const routesIndex: RouteIndex[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, "curated-routes-index.json"), "utf-8")
);

const indexMap = new Map<string, RouteIndex>();
for (const r of routesIndex) indexMap.set(r.slug, r);

const reverseIndex: Record<string, ReverseEntry[]> = {};

for (const [routeSlug, routeData] of Object.entries(routesData)) {
  const meta = indexMap.get(routeSlug);
  if (!meta) continue;

  for (const shelter of routeData.shelters) {
    if (!reverseIndex[shelter.slug]) reverseIndex[shelter.slug] = [];
    reverseIndex[shelter.slug].push({
      slug: routeSlug,
      name: meta.name,
      length_km: meta.length_km,
      region: meta.region,
      distance_km: Math.round(shelter.distance_to_trail_km * 100) / 100,
    });
  }
}

// Sort each shelter's routes by distance
for (const entries of Object.values(reverseIndex)) {
  entries.sort((a, b) => a.distance_km - b.distance_km);
}

const outPath = path.join(dataDir, "shelter-routes-index.json");
fs.writeFileSync(outPath, JSON.stringify(reverseIndex));

const shelterCount = Object.keys(reverseIndex).length;
const totalEntries = Object.values(reverseIndex).reduce((s, e) => s + e.length, 0);
console.log(`Wrote ${outPath}: ${shelterCount} shelters, ${totalEntries} route links`);
