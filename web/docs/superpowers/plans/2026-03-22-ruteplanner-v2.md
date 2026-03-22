# Kuraterede Vandreruter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the interactive route planner with a curated routes page showing 234 hiking trails from Naturstyrelsen with nearby shelters, AI-generated descriptions, filtering, and GPX export.

**Architecture:** Two-phase data pipeline (build-script generates index + full JSON from GeoFA trails and Supabase shelters), then a client-rendered page with lazy-loaded route geometry. The page replaces the existing interactive ruteplanner components.

**Tech Stack:** Next.js 14 (App Router), Supabase, Leaflet/react-leaflet, Tailwind CSS, Claude API (for descriptions), Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `types/curated-route.ts` | **CREATE** — `CuratedRouteIndex`, `CuratedRouteData`, `RouteShelter` types |
| `lib/gpx-export.ts` | **MODIFY** — Add `generateRouteGpx()` and `downloadRouteGpx()` for GeoJSON track geometry |
| `lib/__tests__/gpx-export.test.ts` | **MODIFY** — Add tests for new route GPX functions |
| `scripts/generate-curated-routes.ts` | **CREATE** — Build script: match trails→shelters, output index + full JSON |
| `scripts/generate-route-descriptions.ts` | **CREATE** — One-time script: generate AI descriptions via Claude API |
| `components/RouteCard.tsx` | **CREATE** — Card component for route list |
| `components/RouteDetail.tsx` | **CREATE** — Detail view with shelter list + GPX download |
| `components/RouteFilters.tsx` | **CREATE** — Region, length, sort dropdowns |
| `components/CuratedRoutesMap.tsx` | **CREATE** — Leaflet map showing route geometry + shelter markers |
| `components/CuratedRoutesClient.tsx` | **CREATE** — Main client wrapper: state, data loading, URL sync, layout |
| `app/(site)/ruteplanner/page.tsx` | **REWRITE** — Server component with new metadata, Suspense wrapper |
| `components/RoutePlannerClient.tsx` | **DELETE** — Replaced by CuratedRoutesClient |
| `components/RoutePlannerMap.tsx` | **DELETE** — Replaced by CuratedRoutesMap |
| `components/RoutePlannerSidebar.tsx` | **DELETE** — Replaced by RouteCard + RouteDetail |
| `app/globals.css` | **MODIFY** — Remove `.waypoint-marker` and `.trail-tooltip` CSS |

### Dependencies

- Tasks 1-2: Independent (types + GPX export)
- Task 3: Independent (build script, generates data files)
- Task 4: Independent (description script)
- Tasks 5-8: Depend on Task 1 (types). Can be built in parallel with each other.
- Task 9: Depends on Tasks 5-8 (assembles all components)
- Task 10: Depends on Task 9 (server page)
- Task 11: Depends on Task 10 (cleanup old code)
- Task 12: Depends on Task 10 (build verification)

---

### Task 1: Route types

**Files:**
- Create: `types/curated-route.ts`

- [ ] **Step 1: Create the type definitions**

```typescript
// types/curated-route.ts

export interface RouteShelter {
  id: string;
  slug: string;
  title: string;
  lat: number;
  lon: number;
  distance_to_trail_km: number;
  capacity?: number | null;
  water?: boolean | null;
  toilet?: "flush" | "mulch" | "none" | "unknown" | null;
}

/** Lightweight index entry — loaded on page mount (~50-100 KB total) */
export interface CuratedRouteIndex {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne";
  length_km: number;
  shelter_count: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

/** Full route data — lazy-loaded per route */
export interface CuratedRouteData {
  geometry: GeoJSON.MultiLineString | GeoJSON.LineString;
  shelters: RouteShelter[];
}

/** Lookup map: slug → route data */
export type CuratedRouteDataMap = Record<string, CuratedRouteData>;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add types/curated-route.ts && git commit -m "feat(ruteplanner-v2): add curated route type definitions"
```

---

### Task 2: Extend GPX export for route geometry

**Files:**
- Modify: `lib/gpx-export.ts`
- Modify: `lib/__tests__/gpx-export.test.ts`

- [ ] **Step 1: Write failing tests for generateRouteGpx**

Add to `lib/__tests__/gpx-export.test.ts`:

```typescript
import { generateRouteGpx } from "@/lib/gpx-export";

describe("generateRouteGpx", () => {
  const lineGeometry: GeoJSON.LineString = {
    type: "LineString",
    coordinates: [
      [10.0, 56.0],
      [10.1, 56.1],
      [10.2, 56.2],
    ],
  };

  const multiLineGeometry: GeoJSON.MultiLineString = {
    type: "MultiLineString",
    coordinates: [
      [
        [10.0, 56.0],
        [10.1, 56.1],
      ],
      [
        [10.2, 56.2],
        [10.3, 56.3],
      ],
    ],
  };

  const shelters = [
    { name: "Shelter A", lat: 56.05, lon: 10.05 },
    { name: "Shelter B", lat: 56.15, lon: 10.15 },
  ];

  it("generates GPX with track from LineString geometry", () => {
    const gpx = generateRouteGpx("Testrute", lineGeometry, shelters);
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<name>Testrute</name>");
    expect(gpx).toContain('<trkpt lat="56" lon="10"');
    expect(gpx).toContain('<trkpt lat="56.1" lon="10.1"');
    expect(gpx).toContain('<trkpt lat="56.2" lon="10.2"');
    expect(gpx).toContain('<wpt lat="56.05" lon="10.05">');
    expect(gpx).toContain("<name>Shelter A</name>");
  });

  it("generates GPX with multiple track segments from MultiLineString", () => {
    const gpx = generateRouteGpx("Multi", multiLineGeometry, shelters);
    const segments = gpx.match(/<trkseg>/g);
    expect(segments).toHaveLength(2);
  });

  it("escapes XML in route name", () => {
    const gpx = generateRouteGpx('Rute "Test" & Co', lineGeometry, []);
    expect(gpx).toContain("&amp;");
    expect(gpx).toContain("&quot;");
  });

  it("works with empty shelter list", () => {
    const gpx = generateRouteGpx("Solo", lineGeometry, []);
    expect(gpx).toContain("<trk>");
    expect(gpx).not.toContain("<wpt");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/gpx-export.test.ts
```

Expected: FAIL — `generateRouteGpx` is not exported.

- [ ] **Step 3: Implement generateRouteGpx and downloadRouteGpx**

Add to `lib/gpx-export.ts` (after existing functions):

```typescript
/**
 * Generate GPX from a named route with GeoJSON track geometry and shelter waypoints.
 * Track comes from the GeoJSON geometry (LineString or MultiLineString).
 * Waypoints are shelters near the route.
 */
export function generateRouteGpx(
  routeName: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): string {
  const wptElements = shelterWaypoints
    .map(
      (w) =>
        `  <wpt lat="${w.lat}" lon="${w.lon}">\n    <name>${escapeXml(w.name)}</name>\n  </wpt>`
    )
    .join("\n");

  // Build track segments from geometry coordinates
  const lineArrays =
    trackGeometry.type === "MultiLineString"
      ? trackGeometry.coordinates
      : [trackGeometry.coordinates];

  const trksegs = lineArrays
    .map((line) => {
      const pts = line
        .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}" />`)
        .join("\n");
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join("\n");

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="ShelterDK Ruteplanner" xmlns="http://www.topografix.com/GPX/1/1">',
  ];
  if (wptElements) parts.push(wptElements);
  parts.push(`  <trk>\n    <name>${escapeXml(routeName)}</name>\n${trksegs}\n  </trk>`);
  parts.push("</gpx>");

  return parts.join("\n");
}

/** Download GPX for a curated route. */
export function downloadRouteGpx(
  routeName: string,
  slug: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): void {
  const gpx = generateRouteGpx(routeName, trackGeometry, shelterWaypoints);
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/gpx-export.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add lib/gpx-export.ts lib/__tests__/gpx-export.test.ts && git commit -m "feat(ruteplanner-v2): add generateRouteGpx for GeoJSON track geometry"
```

---

### Task 3: Build script — generate curated routes data

**Files:**
- Create: `scripts/generate-curated-routes.ts`

**Context:**
- Read existing `scripts/import-geofa-trails.ts` for GeoFA data format patterns
- Read existing `scripts/analyze-trails-shelters.ts` for shelter proximity analysis patterns
- Uses `lib/haversine.ts` → `haversineKm` for distance calculation
- Uses `lib/shelter-detail.ts` → `getLocationCoords` for parsing POINT(lon lat)
- Uses `lib/slug.ts` → `slugifySegment` for slug generation
- Reads `public/data/trails.json` (existing GeoFA import)
- Fetches shelters from Supabase using `.env.local` credentials
- Region determination: uses first coordinate of trail, matched against approximate bounding boxes:
  - Sjælland og Øerne: lon > 11.0 AND lat > 54.5
  - Fyn og Øerne: lon 9.6-11.0 AND lat 54.7-55.8
  - Jylland: everything else

The script outputs TWO files:
1. `public/data/curated-routes-index.json` — lightweight index (~50-100 KB)
2. `public/data/curated-routes.json` — full data with geometry + shelters

- [ ] **Step 1: Write the script**

```typescript
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
```

- [ ] **Step 2: Run the script**

```bash
cd /Users/CKA/shelterdk/web && npx tsx scripts/generate-curated-routes.ts
```

Expected: Creates `public/data/curated-routes-index.json` (~50-100 KB) and `public/data/curated-routes.json` (~3-8 MB). Should find ~234 routes.

- [ ] **Step 3: Add generated files to .gitignore**

Add to `.gitignore`:

```
public/data/curated-routes-index.json
public/data/curated-routes.json
```

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add scripts/generate-curated-routes.ts .gitignore && git commit -m "feat(ruteplanner-v2): add build script for curated route data"
```

---

### Task 4: AI description generation script

**Files:**
- Create: `scripts/generate-route-descriptions.ts`

**Context:**
- Uses Claude API (`@anthropic-ai/sdk`) — check if already in `package.json`, install if not
- Reads `public/data/curated-routes-index.json` for route metadata
- Reads `public/data/curated-routes.json` for shelter names
- Updates both files with generated descriptions
- Uses `ANTHROPIC_API_KEY` env var

- [ ] **Step 1: Check if Anthropic SDK is installed**

```bash
cd /Users/CKA/shelterdk/web && grep -q "@anthropic-ai/sdk" package.json && echo "installed" || npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Write the script**

```typescript
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
```

- [ ] **Step 3: Run the script** (requires ANTHROPIC_API_KEY)

```bash
cd /Users/CKA/shelterdk/web && ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-route-descriptions.ts
```

Note: This may take several minutes for 234 routes at 200ms intervals. The script is idempotent — only generates for routes with empty descriptions.

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add scripts/generate-route-descriptions.ts && git commit -m "feat(ruteplanner-v2): add AI description generation script"
```

---

### Task 5: RouteCard component

**Files:**
- Create: `components/RouteCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/RouteCard.tsx
"use client";

import { MapPin, Ruler } from "lucide-react";
import type { CuratedRouteIndex } from "@/types/curated-route";

interface Props {
  route: CuratedRouteIndex;
  isSelected: boolean;
  onClick: () => void;
}

export function RouteCard({ route, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border bg-white shadow-sm p-5 transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-accent ring-2 ring-accent/20"
          : "border-primary/10 hover:border-accent/40 hover:shadow-md"
      }`}
    >
      <h3 className="font-serif text-lg font-semibold text-primary leading-tight">
        {route.name}
      </h3>
      <div className="flex items-center gap-3 mt-2 text-sm text-primary/50">
        <span className="flex items-center gap-1">
          <Ruler size={14} />
          {route.length_km} km
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={14} />
          {route.shelter_count} shelters
        </span>
      </div>
      <p className="text-xs text-primary/40 mt-1">{route.region}</p>
      {route.description && (
        <p className="text-sm text-primary/60 mt-3 line-clamp-2">
          {route.description}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RouteCard.tsx && git commit -m "feat(ruteplanner-v2): add RouteCard component"
```

---

### Task 6: RouteFilters component

**Files:**
- Create: `components/RouteFilters.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/RouteFilters.tsx
"use client";

export type RegionFilter = "" | "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne";
export type LengthFilter = "" | "short" | "medium" | "long";
export type SortOption = "shelters" | "longest" | "shortest" | "name";

interface Props {
  region: RegionFilter;
  length: LengthFilter;
  sort: SortOption;
  onRegionChange: (v: RegionFilter) => void;
  onLengthChange: (v: LengthFilter) => void;
  onSortChange: (v: SortOption) => void;
  resultCount: number;
}

const selectClass =
  "rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50";

export function RouteFilters({
  region,
  length,
  sort,
  onRegionChange,
  onLengthChange,
  onSortChange,
  resultCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={region}
        onChange={(e) => onRegionChange(e.target.value as RegionFilter)}
        className={selectClass}
        aria-label="Filtrer efter region"
      >
        <option value="">Alle regioner</option>
        <option value="Jylland">Jylland</option>
        <option value="Fyn og Øerne">Fyn og Øerne</option>
        <option value="Sjælland og Øerne">Sjælland og Øerne</option>
      </select>

      <select
        value={length}
        onChange={(e) => onLengthChange(e.target.value as LengthFilter)}
        className={selectClass}
        aria-label="Filtrer efter rutelængde"
      >
        <option value="">Alle længder</option>
        <option value="short">Kort (&lt; 10 km)</option>
        <option value="medium">Mellem (10–50 km)</option>
        <option value="long">Lang (50+ km)</option>
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className={selectClass}
        aria-label="Sortér ruter"
      >
        <option value="shelters">Flest shelters</option>
        <option value="longest">Længste rute</option>
        <option value="shortest">Korteste rute</option>
        <option value="name">Navn A-Å</option>
      </select>

      <span className="text-sm text-primary/40 ml-auto">
        {resultCount} ruter
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RouteFilters.tsx && git commit -m "feat(ruteplanner-v2): add RouteFilters component"
```

---

### Task 7: RouteDetail component

**Files:**
- Create: `components/RouteDetail.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/RouteDetail.tsx
"use client";

import { ArrowLeft, Download, Share2 } from "lucide-react";
import { formatDistance } from "@/lib/haversine";
import type { CuratedRouteIndex, RouteShelter } from "@/types/curated-route";
import Link from "next/link";
import { useState } from "react";

interface Props {
  route: CuratedRouteIndex;
  shelters: RouteShelter[];
  onBack: () => void;
  onDownloadGpx: () => void;
  onShare: () => void;
}

export function RouteDetail({ route, shelters, onBack, onDownloadGpx, onShare }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white border-t border-primary/10 px-6 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Tilbage til alle ruter
      </button>

      <h2 className="font-serif text-2xl font-bold text-primary">{route.name}</h2>
      <div className="flex items-center gap-2 mt-1 text-sm text-primary/50">
        <span>{route.length_km} km</span>
        <span>·</span>
        <span>{route.shelter_count} shelters</span>
        <span>·</span>
        <span>{route.region}</span>
      </div>

      {route.description && (
        <p className="text-primary/70 mt-4 leading-relaxed">{route.description}</p>
      )}

      <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">
        Shelters langs ruten
      </h3>
      <div className="divide-y divide-primary/5">
        {shelters.map((shelter, i) => (
          <div key={shelter.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <Link
                  href={`/shelter/${shelter.slug}`}
                  className="text-sm font-medium text-primary hover:text-accent transition-colors"
                >
                  {shelter.title}
                </Link>
                <div className="text-xs text-primary/40 flex items-center gap-2 mt-0.5">
                  {shelter.capacity && <span>{shelter.capacity} pl.</span>}
                  {shelter.water && <span>Vand</span>}
                  {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && (
                    <span>Toilet</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs text-primary/40">
              {formatDistance(shelter.distance_to_trail_km)} fra ruten
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onDownloadGpx}
          className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={16} />
          Download GPX
        </button>
        <button
          onClick={handleShare}
          className="py-2.5 px-5 rounded-xl border border-primary/15 text-primary/70 text-sm font-medium hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5"
        >
          <Share2 size={14} />
          {copied ? "Kopieret!" : "Del rute"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RouteDetail.tsx && git commit -m "feat(ruteplanner-v2): add RouteDetail component"
```

---

### Task 8: CuratedRoutesMap component

**Files:**
- Create: `components/CuratedRoutesMap.tsx`

**Context:**
- Follow same Leaflet patterns as existing `RoutePlannerMap.tsx`: DefaultIcon, tile layer, `L.Marker.prototype.options.icon`
- Use `react-leaflet` components: `MapContainer`, `TileLayer`, `GeoJSON`, `Marker`, `Tooltip`, `useMap`
- Import `leaflet/dist/leaflet.css`
- This is a default export (for dynamic import with `ssr: false`)

- [ ] **Step 1: Create the component**

```typescript
// components/CuratedRoutesMap.tsx
"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Tooltip,
  Rectangle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CuratedRouteIndex, CuratedRouteData } from "@/types/curated-route";

const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_CENTER: [number, number] = [56.2639, 9.5018];
const DEFAULT_ZOOM = 7;

const ROUTE_STYLE = {
  color: "#C5A059",
  weight: 4,
  opacity: 1,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

const OVERVIEW_ROUTE_STYLE = {
  color: "#C5A059",
  weight: 2,
  opacity: 0.5,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

const OVERVIEW_ROUTE_HOVER = {
  weight: 3.5,
  opacity: 1,
};

interface Props {
  /** All routes index for overview bbox rendering */
  routeIndex: CuratedRouteIndex[];
  /** Full route data when a route is selected (null = overview mode) */
  routeData: CuratedRouteData | null;
  /** Slug of selected route (used as GeoJSON key) */
  selectedSlug: string | null;
  /** Called when user clicks a route bbox on the overview map */
  onRouteClick?: (slug: string) => void;
  /** Full route data map for overview rendering (loaded lazily) */
  allRouteData: Record<string, CuratedRouteData> | null;
}

/** Zoom to selected route bounds. */
function FitBounds({ routeData }: { routeData: CuratedRouteData }) {
  const map = useMap();

  useEffect(() => {
    const bounds: [number, number][] = [];
    const extractCoords = (coords: number[][]) => {
      for (const [lon, lat] of coords) bounds.push([lat, lon]);
    };
    const geom = routeData.geometry;
    if (geom.type === "LineString") {
      extractCoords(geom.coordinates);
    } else if (geom.type === "MultiLineString") {
      for (const line of geom.coordinates) extractCoords(line);
    }
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    }
  }, [map, routeData]);

  return null;
}

/** Reset zoom to Denmark overview when deselecting. */
function ResetView({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (active) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
    }
  }, [map, active]);
  return null;
}

/** Overview mode: render all routes as GeoJSON lines (if data loaded) or bbox rectangles. */
function OverviewRoutes({
  routeIndex,
  allRouteData,
  onRouteClick,
}: {
  routeIndex: CuratedRouteIndex[];
  allRouteData: Record<string, CuratedRouteData> | null;
  onRouteClick?: (slug: string) => void;
}) {
  // If full data is loaded, render actual route lines
  if (allRouteData) {
    const geoJsonData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection" as const,
      features: routeIndex
        .filter((r) => allRouteData[r.slug])
        .map((r) => ({
          type: "Feature" as const,
          properties: { slug: r.slug, name: r.name },
          geometry: allRouteData[r.slug].geometry,
        })),
    };

    return (
      <GeoJSON
        key="overview-routes"
        data={geoJsonData}
        style={() => OVERVIEW_ROUTE_STYLE}
        onEachFeature={(feature, layer) => {
          if (feature.properties?.name) {
            layer.bindTooltip(feature.properties.name, {
              sticky: true,
              className: "text-sm font-medium",
            });
          }
          layer.on("mouseover", () => {
            (layer as L.Path).setStyle(OVERVIEW_ROUTE_HOVER);
          });
          layer.on("mouseout", () => {
            (layer as L.Path).setStyle(OVERVIEW_ROUTE_STYLE);
          });
          layer.on("click", () => {
            if (onRouteClick && feature.properties?.slug) {
              onRouteClick(feature.properties.slug);
            }
          });
        }}
      />
    );
  }

  // Fallback: render bbox rectangles before full data is loaded
  return (
    <>
      {routeIndex.map((r) => {
        const [minLon, minLat, maxLon, maxLat] = r.bbox;
        return (
          <Rectangle
            key={r.slug}
            bounds={[
              [minLat, minLon],
              [maxLat, maxLon],
            ]}
            pathOptions={{
              color: "#C5A059",
              weight: 1,
              opacity: 0.3,
              fillOpacity: 0.05,
            }}
            eventHandlers={{
              click: () => onRouteClick?.(r.slug),
            }}
          />
        );
      })}
    </>
  );
}

/** Selected route: geometry line + shelter markers. */
function SelectedRoute({ routeData, slug }: { routeData: CuratedRouteData; slug: string }) {
  const geoJsonData: GeoJSON.FeatureCollection = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: routeData.geometry,
      },
    ],
  };

  return (
    <>
      <GeoJSON
        key={`selected-${slug}`}
        data={geoJsonData}
        style={() => ROUTE_STYLE}
      />

      {routeData.shelters.map((shelter) => (
        <Marker key={shelter.id} position={[shelter.lat, shelter.lon]}>
          <Tooltip direction="top" offset={[0, -20]}>
            <div>
              <div className="text-sm font-medium">{shelter.title}</div>
              <div className="text-xs text-gray-500">
                {shelter.capacity && `${shelter.capacity} pl.`}
                {shelter.water && " · Vand"}
                {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && " · Toilet"}
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}

      <FitBounds routeData={routeData} />
    </>
  );
}

export default function CuratedRoutesMap({
  routeIndex,
  routeData,
  selectedSlug,
  onRouteClick,
  allRouteData,
}: Props) {
  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Overview mode: show all routes */}
        {!selectedSlug && (
          <OverviewRoutes
            routeIndex={routeIndex}
            allRouteData={allRouteData}
            onRouteClick={onRouteClick}
          />
        )}

        {/* Selected mode: show single route + shelters */}
        {selectedSlug && routeData && (
          <SelectedRoute routeData={routeData} slug={selectedSlug} />
        )}

        {/* Reset view when deselecting */}
        <ResetView active={!selectedSlug} />
      </MapContainer>

      {!selectedSlug && !allRouteData && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full shadow-sm px-4 py-2 text-sm text-primary/60 border border-primary/5 pointer-events-none">
          Vælg en rute nedenfor for at se den på kortet
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/CuratedRoutesMap.tsx && git commit -m "feat(ruteplanner-v2): add CuratedRoutesMap component"
```

---

### Task 9: CuratedRoutesClient component

**Files:**
- Create: `components/CuratedRoutesClient.tsx`

**Context:**
- Follow URL state pattern from `RoutePlannerClient.tsx`: `useSearchParams()` + `router.replace()`
- Dynamic import map with `ssr: false` (same pattern)
- Lazy-load route data: fetch `curated-routes.json` on first route selection, cache in state
- Filter/sort logic applied to in-memory index array

- [ ] **Step 1: Create the component**

```typescript
// components/CuratedRoutesClient.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  CuratedRouteIndex,
  CuratedRouteData,
  CuratedRouteDataMap,
} from "@/types/curated-route";
import type { GpxWaypoint } from "@/lib/gpx-export";
import { RouteCard } from "./RouteCard";
import { RouteDetail } from "./RouteDetail";
import {
  RouteFilters,
  type RegionFilter,
  type LengthFilter,
  type SortOption,
} from "./RouteFilters";

const CuratedRoutesMap = dynamic(() => import("./CuratedRoutesMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
      <span className="text-primary/30 text-sm">Indlæser kort...</span>
    </div>
  ),
});

interface Props {
  initialIndex: CuratedRouteIndex[];
}

export function CuratedRoutesClient({ initialIndex }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [routes] = useState(initialIndex);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    searchParams.get("rute") || null
  );
  const [region, setRegion] = useState<RegionFilter>(
    (searchParams.get("region") as RegionFilter) || ""
  );
  const [length, setLength] = useState<LengthFilter>(
    (searchParams.get("laengde") as LengthFilter) || ""
  );
  const [sort, setSort] = useState<SortOption>("shelters");
  const [routeDataCache, setRouteDataCache] = useState<CuratedRouteDataMap>({});
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fullDataRef = useRef<CuratedRouteDataMap | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (length) params.set("laengde", length);
    if (selectedSlug) params.set("rute", selectedSlug);
    const qs = params.toString();
    router.replace(`/ruteplanner${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [region, length, selectedSlug, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Filter + sort
  const filteredRoutes = useMemo(() => {
    let result = routes;

    if (region) {
      result = result.filter((r) => r.region === region);
    }

    if (length === "short") {
      result = result.filter((r) => r.length_km < 10);
    } else if (length === "medium") {
      result = result.filter((r) => r.length_km >= 10 && r.length_km <= 50);
    } else if (length === "long") {
      result = result.filter((r) => r.length_km > 50);
    }

    if (sort === "shelters") {
      result = [...result].sort((a, b) => b.shelter_count - a.shelter_count);
    } else if (sort === "longest") {
      result = [...result].sort((a, b) => b.length_km - a.length_km);
    } else if (sort === "shortest") {
      result = [...result].sort((a, b) => a.length_km - b.length_km);
    } else if (sort === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "da"));
    }

    return result;
  }, [routes, region, length, sort]);

  // Lazy-load full route data
  const loadRouteData = useCallback(
    async (slug: string): Promise<CuratedRouteData | null> => {
      if (routeDataCache[slug]) return routeDataCache[slug];

      // Load full file on first request
      if (!fullDataRef.current) {
        setLoadingRoute(true);
        try {
          const resp = await fetch("/data/curated-routes.json");
          if (!resp.ok) throw new Error("Fetch failed");
          const data: CuratedRouteDataMap = await resp.json();
          fullDataRef.current = data;
          setRouteDataCache(data);
        } catch {
          showToast("Kunne ikke indlæse rutedetaljer");
          setLoadingRoute(false);
          return null;
        }
        setLoadingRoute(false);
      }

      return fullDataRef.current?.[slug] || null;
    },
    [routeDataCache, showToast]
  );

  const handleSelectRoute = useCallback(
    async (slug: string) => {
      if (selectedSlug === slug) {
        setSelectedSlug(null);
        return;
      }
      setSelectedSlug(slug);
      await loadRouteData(slug);
      // Scroll to map
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [selectedSlug, loadRouteData]
  );

  const handleBack = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  const handleDownloadGpx = useCallback(async () => {
    if (!selectedSlug) return;
    const data = await loadRouteData(selectedSlug);
    if (!data) return;
    const selectedRoute = routes.find((r) => r.slug === selectedSlug);
    if (!selectedRoute) return;

    // Dynamic import to avoid loading GPX code until needed
    const { downloadRouteGpx } = await import("@/lib/gpx-export");
    const waypoints: GpxWaypoint[] = data.shelters.map((s) => ({
      name: s.title,
      lat: s.lat,
      lon: s.lon,
    }));
    downloadRouteGpx(
      selectedRoute.name,
      selectedRoute.slug,
      data.geometry,
      waypoints
    );
  }, [selectedSlug, routes, loadRouteData]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {
      showToast("Kunne ikke kopiere link");
    });
  }, [showToast]);

  const selectedRoute = selectedSlug
    ? routes.find((r) => r.slug === selectedSlug) || null
    : null;
  const selectedRouteData = selectedSlug
    ? routeDataCache[selectedSlug] || null
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <h1 className="font-serif text-3xl font-bold text-primary">
          Vandreruter med shelters
        </h1>
        <p className="text-primary/60 text-base mt-2">
          Udforsk {routes.length} vandreruter fra Naturstyrelsen med shelters langs vejen
        </p>
      </div>

      {/* Map */}
      <div ref={mapSectionRef} className="w-full h-[40vh] md:h-[40vh]">
        {loadingRoute ? (
          <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
            <span className="text-primary/30 text-sm">Indlæser rute...</span>
          </div>
        ) : (
          <CuratedRoutesMap
            routeIndex={routes}
            routeData={selectedRouteData}
            selectedSlug={selectedSlug}
            onRouteClick={handleSelectRoute}
            allRouteData={fullDataRef.current}
          />
        )}
      </div>

      {/* Detail overlay (when route selected) */}
      {selectedRoute && selectedRouteData && (
        <RouteDetail
          route={selectedRoute}
          shelters={selectedRouteData.shelters}
          onBack={handleBack}
          onDownloadGpx={handleDownloadGpx}
          onShare={handleShare}
        />
      )}

      {/* Filters + Card grid (when no route selected) */}
      {!selectedSlug && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <RouteFilters
            region={region}
            length={length}
            sort={sort}
            onRegionChange={setRegion}
            onLengthChange={setLength}
            onSortChange={setSort}
            resultCount={filteredRoutes.length}
          />

          {filteredRoutes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-primary/50">Ingen ruter matcher dine filtre</p>
              <button
                onClick={() => {
                  setRegion("");
                  setLength("");
                }}
                className="mt-2 text-sm text-accent hover:underline"
              >
                Nulstil filtre
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {filteredRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedSlug === route.slug}
                  onClick={() => handleSelectRoute(route.slug)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/CuratedRoutesClient.tsx && git commit -m "feat(ruteplanner-v2): add CuratedRoutesClient with filters, lazy-load, and URL sync"
```

---

### Task 10: Server page rewrite

**Files:**
- Rewrite: `app/(site)/ruteplanner/page.tsx`

**Context:**
- The server component reads the index JSON at build time (it's in `public/data/`, so use `fs.readFileSync` in a server component or fetch from the public URL)
- Actually: since this is in `public/`, the client fetches it. But we can read it at build time for SSR. The simplest approach: read the file server-side and pass as props.
- Wait — `public/data/curated-routes-index.json` is a static file. We can read it with `fs` in the server component since Next.js server components can use Node APIs.

- [ ] **Step 1: Rewrite the page**

```typescript
// app/(site)/ruteplanner/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import * as fs from "fs";
import * as path from "path";
import { CuratedRoutesClient } from "@/components/CuratedRoutesClient";
import type { CuratedRouteIndex } from "@/types/curated-route";

export const metadata: Metadata = {
  title: "Vandreruter med shelters — Udforsk Danmarks bedste vandreruter",
  description:
    "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
};

function loadRouteIndex(): CuratedRouteIndex[] {
  try {
    const filePath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function RutePlannerPage() {
  const index = loadRouteIndex();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser vandreruter...</span>
        </div>
      }
    >
      <CuratedRoutesClient initialIndex={index} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add app/\(site\)/ruteplanner/page.tsx && git commit -m "feat(ruteplanner-v2): rewrite server page for curated routes"
```

---

### Task 11: Remove old ruteplanner components

**Files:**
- Delete: `components/RoutePlannerClient.tsx`
- Delete: `components/RoutePlannerMap.tsx`
- Delete: `components/RoutePlannerSidebar.tsx`
- Modify: `app/globals.css` — remove `.waypoint-marker` and `.trail-tooltip` CSS
- Modify: `types/shelter.ts` — remove `RoutePlannerShelter` (no longer used)

- [ ] **Step 1: Delete old components**

```bash
cd /Users/CKA/shelterdk/web && rm components/RoutePlannerClient.tsx components/RoutePlannerMap.tsx components/RoutePlannerSidebar.tsx
```

- [ ] **Step 2: Remove old CSS from globals.css**

Remove the `.waypoint-marker` block (6 lines starting with `/* Ruteplanner – numbered waypoint markers */`) and the `.trail-tooltip` block (8 lines starting with `/* Ruteplanner – trail name tooltip */`) from `app/globals.css`.

- [ ] **Step 3: Remove RoutePlannerShelter from types/shelter.ts**

Remove the `RoutePlannerShelter` interface and its doc comment from `types/shelter.ts` (lines 1-10 approximately).

- [ ] **Step 4: Verify no remaining imports of deleted files**

```bash
cd /Users/CKA/shelterdk/web && grep -r "RoutePlannerClient\|RoutePlannerMap\|RoutePlannerSidebar\|RoutePlannerShelter" --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".git"
```

Expected: No results (all references removed).

- [ ] **Step 5: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add -A && git commit -m "chore(ruteplanner-v2): remove old interactive planner components"
```

---

### Task 12: Build verification + integration test

**Files:** None (verification only)

- [ ] **Step 1: Run tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: All tests pass, including new GPX route tests.

- [ ] **Step 2: Run production build**

```bash
cd /Users/CKA/shelterdk/web && npx next build
```

Expected: Build succeeds. `/ruteplanner` page listed as static (○).

- [ ] **Step 3: Start dev server and verify page loads**

```bash
cd /Users/CKA/shelterdk/web && npm run dev
```

Open `http://localhost:3000/ruteplanner`. Verify:
1. Page loads with heading "Vandreruter med shelters"
2. Map visible (Denmark overview)
3. Route cards visible below map
4. Filters work (region, length, sort)
5. Click a route → map zooms in, detail view shows shelters
6. "Download GPX" button works
7. "Del rute" copies URL
8. "Tilbage" returns to list view
9. URL updates with `?rute=slug` and `?region=`

- [ ] **Step 4: Commit verification (if any fixes needed)**

```bash
cd /Users/CKA/shelterdk/web && git add -A && git commit -m "fix(ruteplanner-v2): address build/integration issues"
```
