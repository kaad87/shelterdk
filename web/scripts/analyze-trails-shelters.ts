/**
 * Analyze GeoFA trail data against shelter locations from Supabase.
 *
 * For each trail, finds shelters within 2km of any point on the trail geometry.
 * Outputs stats and top trails by number of nearby shelters.
 *
 * Usage:
 *   cd web && npx tsx scripts/analyze-trails-shelters.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const TRAILS_PATH = path.resolve(__dirname, "../public/data/trails.json");
const MAX_DISTANCE_KM = 2;

// --------------- Haversine ---------------
const R_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --------------- Types ---------------
interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

interface ShelterLoc {
  id: string;
  title: string;
  lon: number;
  lat: number;
}

// --------------- Fetch shelters ---------------
async function fetchAllShelters(): Promise<ShelterLoc[]> {
  const shelters: ShelterLoc[] = [];
  const PAGE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, title, location")
      .is("duplicate_of_shelter_id", null)
      .not("location", "is", null)
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error("Supabase error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const m = (row.location as string).match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (m) {
        shelters.push({
          id: row.id,
          title: row.title,
          lon: parseFloat(m[1]),
          lat: parseFloat(m[2]),
        });
      }
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  return shelters;
}

// --------------- Sample points along trail ---------------
function sampleTrailPoints(geometry: Trail["geometry"]): [number, number][] {
  // Flatten MultiLineString / LineString into list of coordinate arrays (lines)
  let lines: number[][][] = [];
  if (geometry.type === "MultiLineString") {
    lines = geometry.coordinates as number[][][];
  } else if (geometry.type === "LineString") {
    lines = [geometry.coordinates as number[][]];
  } else {
    return [];
  }

  const points: [number, number][] = [];
  const TARGET_SPACING_KM = 0.5; // sample every ~500m

  for (const line of lines) {
    if (line.length === 0) continue;

    // Always include first point
    points.push([line[0][0], line[0][1]]);

    let accumulatedDist = 0;
    for (let i = 1; i < line.length; i++) {
      const d = haversineKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
      accumulatedDist += d;
      if (accumulatedDist >= TARGET_SPACING_KM) {
        points.push([line[i][0], line[i][1]]);
        accumulatedDist = 0;
      }
    }

    // Always include last point
    const last = line[line.length - 1];
    points.push([last[0], last[1]]);
  }

  return points;
}

// --------------- Compute trail length ---------------
function trailLengthKm(geometry: Trail["geometry"]): number {
  let lines: number[][][] = [];
  if (geometry.type === "MultiLineString") {
    lines = geometry.coordinates as number[][][];
  } else if (geometry.type === "LineString") {
    lines = [geometry.coordinates as number[][]];
  } else {
    return 0;
  }

  let total = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      total += haversineKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    }
  }
  return total;
}

// --------------- Main ---------------
async function main() {
  console.log("Fetching shelters from Supabase...");
  const shelters = await fetchAllShelters();
  console.log(`Loaded ${shelters.length} shelters with locations.\n`);

  console.log("Reading trails.json...");
  const raw = fs.readFileSync(TRAILS_PATH, "utf-8");
  const trails: Trail[] = JSON.parse(raw);
  console.log(`Loaded ${trails.length} trails.\n`);

  // For each trail, find nearby shelters
  interface TrailResult {
    id: string;
    name: string;
    descriptionLength: number;
    trailLengthKm: number;
    nearbyShelterCount: number;
    nearbyShelters: string[];
  }

  const results: TrailResult[] = [];

  for (const trail of trails) {
    const samplePts = sampleTrailPoints(trail.geometry);
    const lengthKm = trailLengthKm(trail.geometry);
    const nearbyShelterIds = new Set<string>();
    const nearbyShelterNames: string[] = [];

    for (const shelter of shelters) {
      // Quick bounding-box pre-filter (~2km ≈ 0.02° lat)
      let closeEnough = false;
      for (const [lon, lat] of samplePts) {
        if (
          Math.abs(shelter.lat - lat) > 0.025 ||
          Math.abs(shelter.lon - lon) > 0.035
        ) {
          continue;
        }
        const dist = haversineKm(lon, lat, shelter.lon, shelter.lat);
        if (dist <= MAX_DISTANCE_KM) {
          closeEnough = true;
          break;
        }
      }
      if (closeEnough && !nearbyShelterIds.has(shelter.id)) {
        nearbyShelterIds.add(shelter.id);
        nearbyShelterNames.push(shelter.title);
      }
    }

    results.push({
      id: trail.id,
      name: trail.name,
      descriptionLength: trail.description?.length ?? 0,
      trailLengthKm: Math.round(lengthKm * 10) / 10,
      nearbyShelterCount: nearbyShelterIds.size,
      nearbyShelters: nearbyShelterNames,
    });
  }

  // Sort by nearby shelter count descending
  results.sort((a, b) => b.nearbyShelterCount - a.nearbyShelterCount);

  // --------------- Output stats ---------------
  const withAtLeast2 = results.filter((r) => r.nearbyShelterCount >= 2).length;
  const withAtLeast3 = results.filter((r) => r.nearbyShelterCount >= 3).length;
  const withAtLeast1 = results.filter((r) => r.nearbyShelterCount >= 1).length;
  const withNone = results.filter((r) => r.nearbyShelterCount === 0).length;

  console.log("=== SHELTER PROXIMITY ANALYSIS ===\n");
  console.log(`Total trails:                   ${trails.length}`);
  console.log(`Trails with 0 shelters (<2km):  ${withNone}`);
  console.log(`Trails with >= 1 shelter:       ${withAtLeast1}`);
  console.log(`Trails with >= 2 shelters:      ${withAtLeast2}`);
  console.log(`Trails with >= 3 shelters:      ${withAtLeast3}`);

  console.log("\n=== TOP 20 TRAILS BY NEARBY SHELTERS ===\n");
  console.log(
    "Rank | Shelters | Length(km) | Desc(chars) | Trail Name"
  );
  console.log("-----|----------|------------|-------------|----------");
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padStart(4)} | ${String(r.nearbyShelterCount).padStart(8)} | ${String(r.trailLengthKm).padStart(10)} | ${String(r.descriptionLength).padStart(11)} | ${r.name}`
    );
  }

  // Show shelter names for top 5
  console.log("\n=== TOP 5 — NEARBY SHELTER DETAILS ===\n");
  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r = results[i];
    console.log(`${i + 1}. ${r.name} (${r.nearbyShelterCount} shelters, ${r.trailLengthKm} km):`);
    for (const s of r.nearbyShelters) {
      console.log(`   - ${s}`);
    }
    console.log();
  }

  // --------------- Quality signals analysis ---------------
  console.log("=== QUALITY SIGNALS ANALYSIS ===\n");

  // Description stats
  const withDesc = results.filter((r) => r.descriptionLength > 0);
  const avgDescLen =
    withDesc.length > 0
      ? Math.round(withDesc.reduce((s, r) => s + r.descriptionLength, 0) / withDesc.length)
      : 0;
  console.log(`Trails with description:        ${withDesc.length} / ${results.length}`);
  console.log(`Avg description length:         ${avgDescLen} chars`);

  // Trail length stats
  const lengths = results.map((r) => r.trailLengthKm).filter((l) => l > 0);
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
  const avg = Math.round((lengths.reduce((s, l) => s + l, 0) / lengths.length) * 10) / 10;
  const min = lengths[0] ?? 0;
  const max = lengths[lengths.length - 1] ?? 0;
  console.log(`\nTrail length stats (km):`);
  console.log(`  Min:    ${min}`);
  console.log(`  Median: ${median}`);
  console.log(`  Avg:    ${avg}`);
  console.log(`  Max:    ${max}`);

  // Correlation: trails with shelters vs description
  const shelterTrails = results.filter((r) => r.nearbyShelterCount >= 1);
  const shelterWithDesc = shelterTrails.filter((r) => r.descriptionLength > 0);
  const noShelterTrails = results.filter((r) => r.nearbyShelterCount === 0);
  const noShelterWithDesc = noShelterTrails.filter((r) => r.descriptionLength > 0);

  console.log(`\nDescription presence by shelter proximity:`);
  console.log(
    `  Trails WITH shelters:    ${shelterWithDesc.length}/${shelterTrails.length} have description (${Math.round((shelterWithDesc.length / (shelterTrails.length || 1)) * 100)}%)`
  );
  console.log(
    `  Trails WITHOUT shelters: ${noShelterWithDesc.length}/${noShelterTrails.length} have description (${Math.round((noShelterWithDesc.length / (noShelterTrails.length || 1)) * 100)}%)`
  );

  // Average trail length for trails with/without shelters
  const avgLenWithShelters =
    shelterTrails.length > 0
      ? Math.round(
          (shelterTrails.reduce((s, r) => s + r.trailLengthKm, 0) / shelterTrails.length) * 10
        ) / 10
      : 0;
  const avgLenWithout =
    noShelterTrails.length > 0
      ? Math.round(
          (noShelterTrails.reduce((s, r) => s + r.trailLengthKm, 0) / noShelterTrails.length) * 10
        ) / 10
      : 0;
  console.log(`\nAvg trail length by shelter proximity:`);
  console.log(`  Trails WITH shelters:    ${avgLenWithShelters} km`);
  console.log(`  Trails WITHOUT shelters: ${avgLenWithout} km`);

  // Shelter density distribution
  console.log("\n=== SHELTER COUNT DISTRIBUTION ===\n");
  const maxShelters = results[0]?.nearbyShelterCount ?? 0;
  for (let n = 0; n <= Math.min(maxShelters, 15); n++) {
    const count = results.filter((r) => r.nearbyShelterCount === n).length;
    const bar = "#".repeat(Math.min(count, 80));
    console.log(`  ${String(n).padStart(3)} shelters: ${String(count).padStart(4)} trails ${bar}`);
  }
  if (maxShelters > 15) {
    const count = results.filter((r) => r.nearbyShelterCount > 15).length;
    console.log(`  >15 shelters: ${String(count).padStart(4)} trails`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
