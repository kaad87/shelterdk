import fs from "node:fs";
import path from "node:path";

export interface ShelterRouteEntry {
  slug: string;
  name: string;
  length_km: number;
  region: string;
  distance_km: number;
}

type ShelterRoutesIndex = Record<string, ShelterRouteEntry[]>;

let cached: ShelterRoutesIndex | null = null;

function loadIndex(): ShelterRoutesIndex {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public/data/shelter-routes-index.json"),
      "utf-8"
    );
    cached = JSON.parse(raw);
    return cached!;
  } catch {
    return {};
  }
}

export function getRoutesForShelter(shelterSlug: string): ShelterRouteEntry[] {
  return loadIndex()[shelterSlug] ?? [];
}
