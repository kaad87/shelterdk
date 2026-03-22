/**
 * Fetch all hiking trails from GeoFA and write to public/data/trails.json.
 *
 * Usage:
 *   cd web && npx tsx scripts/import-geofa-trails.ts
 */

import * as fs from "fs";
import * as path from "path";

const GEOFA_URL =
  "https://geofa.geodanmark.dk/api/v2/sql/fkg?format=geojson&srs=4326&q=select+objekt_id,+navn,+beskrivels,+geometri+from+fkg.t_5802_fac_li+WHERE+rute_ty_k=5+AND+off_kode=1";

const OUTPUT_PATH = path.resolve(__dirname, "../public/data/trails.json");

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: any;
}

function simplifyCoordinates(geom: any): any {
  if (Array.isArray(geom)) {
    if (typeof geom[0] === "number") {
      return geom.map((n: number) =>
        typeof n === "number" ? Math.round(n * 100000) / 100000 : n
      );
    }
    return geom.map(simplifyCoordinates);
  }
  if (geom && typeof geom === "object" && geom.coordinates) {
    return { ...geom, coordinates: simplifyCoordinates(geom.coordinates) };
  }
  return geom;
}

async function main() {
  console.log("Fetching hiking trails from GeoFA...");
  const resp = await fetch(GEOFA_URL);
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }

  const geojson = await resp.json();
  const features = geojson.features || [];
  console.log(`Received ${features.length} features.`);

  const trails: Trail[] = features
    .filter((f: any) => {
      const name = f.properties?.navn?.trim();
      return name && name.length > 0;
    })
    .map((f: any) => ({
      id: f.properties.objekt_id,
      name: f.properties.navn!.trim(),
      description: f.properties.beskrivels?.trim() || null,
      geometry: simplifyCoordinates(f.geometry),
    }));

  console.log(`Filtered to ${trails.length} trails with names.`);

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(trails);
  fs.writeFileSync(OUTPUT_PATH, json, "utf-8");

  const sizeMB = (Buffer.byteLength(json, "utf-8") / (1024 * 1024)).toFixed(1);
  console.log(`\nWritten to ${OUTPUT_PATH}`);
  console.log(`File size: ${sizeMB} MB`);
  console.log(`Trails: ${trails.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
