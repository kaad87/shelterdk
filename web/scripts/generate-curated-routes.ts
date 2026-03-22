// scripts/generate-curated-routes.ts
/**
 * Generate curated route data from GeoFA trails + Supabase shelters.
 *
 * For each trail with ≥5 shelters within 2km, outputs:
 * - curated-routes-index.json (lightweight, for card list)
 * - curated-routes.json (full geometry + shelter data, lazy-loaded)
 *
 * Usage: cd web && npx tsx scripts/generate-curated-routes.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { haversineKm } from "../lib/haversine";
import { slugifySegment } from "../lib/slug";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or key");
  process.exit(1);
}
const supabase = createClient(url, key);

const MIN_SHELTERS = 5;
const MAX_DISTANCE_KM = 2;
const SAMPLE_INTERVAL_M = 200;

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Geometry;
}

interface ShelterRow {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  capacity: number | null;
  water: boolean | null;
  toilet: string | null;
}

interface ShelterCoords extends ShelterRow {
  lat: number;
  lon: number;
}

function parseLocation(loc: string | null): { lat: number; lon: number } | null {
  if (!loc) return null;
  const m = loc.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i);
  if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
  return null;
}

function determineRegion(lat: number, lon: number): "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne" {
  if (lon > 11.0 && lat > 54.5) return "Sjælland og Øerne";
  if (lon >= 9.6 && lon <= 11.0 && lat >= 54.7 && lat <= 55.8) return "Fyn og Øerne";
  return "Jylland";
}

/**
 * Sample points along a geometry at approximately the given interval.
 * Returns array of [lat, lon] pairs.
 */
function sampleGeometryPoints(geometry: GeoJSON.Geometry): [number, number][] {
  const points: [number, number][] = [];

  const processLine = (coords: number[][]) => {
    if (coords.length === 0) return;
    points.push([coords[0][1], coords[0][0]]); // [lat, lon]

    let accumulatedM = 0;
    for (let i = 1; i < coords.length; i++) {
      const distKm = haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
      accumulatedM += distKm * 1000;
      if (accumulatedM >= SAMPLE_INTERVAL_M) {
        points.push([coords[i][1], coords[i][0]]);
        accumulatedM = 0;
      }
    }
    // Always include last point
    const last = coords[coords.length - 1];
    points.push([last[1], last[0]]);
  };

  if (geometry.type === "LineString") {
    processLine(geometry.coordinates);
  } else if (geometry.type === "MultiLineString") {
    for (const line of geometry.coordinates) {
      processLine(line);
    }
  }

  return points;
}

/** Calculate total trail length in km from geometry. */
function trailLengthKm(geometry: GeoJSON.Geometry): number {
  let total = 0;
  const processLine = (coords: number[][]) => {
    for (let i = 1; i < coords.length; i++) {
      total += haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    }
  };

  if (geometry.type === "LineString") {
    processLine(geometry.coordinates);
  } else if (geometry.type === "MultiLineString") {
    for (const line of geometry.coordinates) processLine(line);
  }
  return total;
}

/** Calculate bounding box [minLon, minLat, maxLon, maxLat] from geometry. */
function calcBbox(geometry: GeoJSON.Geometry): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  const processCoords = (coords: number[][]) => {
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  };

  if (geometry.type === "LineString") {
    processCoords(geometry.coordinates);
  } else if (geometry.type === "MultiLineString") {
    for (const line of geometry.coordinates) processCoords(line);
  }

  return [minLon, minLat, maxLon, maxLat];
}

async function fetchAllShelters(): Promise<ShelterCoords[]> {
  const all: ShelterCoords[] = [];
  let from = 0;
  const BATCH = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, slug, title, location, capacity, water, toilet")
      .is("duplicate_of_shelter_id", null)
      .not("location", "is", null)
      .range(from, from + BATCH - 1);

    if (error) {
      console.error("Supabase error:", error.message);
      if (from === 0) { console.error("First fetch failed — check credentials"); process.exit(1); }
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const coords = parseLocation(row.location);
      if (coords) {
        all.push({ ...row, lat: coords.lat, lon: coords.lon });
      }
    }
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

interface MatchedShelter {
  id: string;
  slug: string;
  title: string;
  lat: number;
  lon: number;
  distance_to_trail_km: number;
  capacity: number | null;
  water: boolean | null;
  toilet: string | null;
}

function findNearbyShelters(trailPoints: [number, number][], shelters: ShelterCoords[]): MatchedShelter[] {
  const found = new Map<string, MatchedShelter>();

  // Pre-compute bounding box of trail + buffer for quick filtering
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of trailPoints) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  // ~2km buffer in degrees (~0.02 lat, ~0.035 lon at 56°N)
  const latBuffer = 0.02;
  const lonBuffer = 0.035;
  minLat -= latBuffer; maxLat += latBuffer;
  minLon -= lonBuffer; maxLon += lonBuffer;

  const candidateShelters = shelters.filter(
    (s) => s.lat >= minLat && s.lat <= maxLat && s.lon >= minLon && s.lon <= maxLon
  );

  for (const shelter of candidateShelters) {
    let minDist = Infinity;
    for (const [pLat, pLon] of trailPoints) {
      const d = haversineKm(pLat, pLon, shelter.lat, shelter.lon);
      if (d < minDist) minDist = d;
      if (d < 0.1) break; // Close enough, no need to check more points
    }
    if (minDist <= MAX_DISTANCE_KM && !found.has(shelter.id)) {
      found.set(shelter.id, {
        id: shelter.id,
        slug: shelter.slug,
        title: shelter.title,
        lat: shelter.lat,
        lon: shelter.lon,
        distance_to_trail_km: Math.round(minDist * 100) / 100,
        capacity: shelter.capacity,
        water: shelter.water,
        toilet: shelter.toilet,
      });
    }
  }

  return Array.from(found.values()).sort((a, b) => a.distance_to_trail_km - b.distance_to_trail_km);
}

async function main() {
  console.log("Loading trails...");
  const trailsPath = path.resolve(__dirname, "../public/data/trails.json");
  const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, "utf-8"));
  console.log(`  ${trails.length} trails loaded`);

  console.log("Fetching shelters from Supabase...");
  const shelters = await fetchAllShelters();
  console.log(`  ${shelters.length} shelters with coordinates`);

  console.log(`\nMatching trails to shelters (min ${MIN_SHELTERS} shelters, max ${MAX_DISTANCE_KM} km)...`);

  const indexEntries: any[] = [];
  const fullData: Record<string, any> = {};
  const usedSlugs = new Set<string>();

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    if (!trail.name || !trail.geometry) continue;

    const trailPoints = sampleGeometryPoints(trail.geometry);
    if (trailPoints.length === 0) continue;

    const nearbyShelters = findNearbyShelters(trailPoints, shelters);

    if (nearbyShelters.length < MIN_SHELTERS) continue;

    let slug = slugifySegment(trail.name);
    if (!slug) slug = `rute-${trail.id.slice(0, 8)}`;
    // Ensure unique slugs
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    const lengthKm = Math.round(trailLengthKm(trail.geometry) * 10) / 10;
    const bbox = calcBbox(trail.geometry);
    const firstPoint = trailPoints[0];
    const region = determineRegion(firstPoint[0], firstPoint[1]);

    indexEntries.push({
      id: trail.id,
      name: trail.name,
      slug,
      description: "", // AI-generated in separate script (Task 4)
      region,
      length_km: lengthKm,
      shelter_count: nearbyShelters.length,
      bbox,
    });

    fullData[slug] = {
      geometry: trail.geometry,
      shelters: nearbyShelters,
    };

    if ((i + 1) % 500 === 0) {
      console.log(`  Processed ${i + 1}/${trails.length} trails (${indexEntries.length} matched so far)`);
    }
  }

  // Sort by shelter count (descending)
  indexEntries.sort((a, b) => b.shelter_count - a.shelter_count);

  const indexPath = path.resolve(__dirname, "../public/data/curated-routes-index.json");
  const fullPath = path.resolve(__dirname, "../public/data/curated-routes.json");

  fs.writeFileSync(indexPath, JSON.stringify(indexEntries, null, 0));
  fs.writeFileSync(fullPath, JSON.stringify(fullData, null, 0));

  const indexSize = (fs.statSync(indexPath).size / 1024).toFixed(1);
  const fullSize = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(1);

  console.log(`\n=== Done ===`);
  console.log(`Matched routes: ${indexEntries.length}`);
  console.log(`Index file: ${indexPath} (${indexSize} KB)`);
  console.log(`Full data: ${fullPath} (${fullSize} MB)`);
  console.log(`\nTop 10 routes:`);
  for (const r of indexEntries.slice(0, 10)) {
    console.log(`  ${r.name} — ${r.shelter_count} shelters, ${r.length_km} km, ${r.region}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
