import fs from "fs";
import path from "path";

/** Én række i public/data/fri-teltning-index.json (skrevet af fetch_fri_teltning_geofa.py). */
export interface FriTeltningArea {
  id: string;
  slug: string;
  name: string;
  kommune: string | null;
  kommunekode: number | null;
  region: string | null;
  org: string | null;
  contact: string | null;
  link: string | null;
  ha: number | null;
  lat: number;
  lng: number;
  water: boolean;
  description: string | null;
}

/** Samme rækkefølge som region-hubs: største først, Bornholm sidst. */
const REGION_ORDER = ["Jylland", "Sjælland og Øerne", "Fyn", "Bornholm"];

export function loadFriTeltningIndex(): FriTeltningArea[] {
  try {
    const filePath = path.join(process.cwd(), "public/data/fri-teltning-index.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as FriTeltningArea[];
  } catch {
    return [];
  }
}

export function groupByRegion(areas: FriTeltningArea[]): { region: string; areas: FriTeltningArea[] }[] {
  const byRegion = new Map<string, FriTeltningArea[]>();
  for (const a of areas) {
    const key = a.region ?? "Danmark";
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push(a);
  }
  const order = (r: string) => {
    const i = REGION_ORDER.indexOf(r);
    return i === -1 ? REGION_ORDER.length : i;
  };
  return [...byRegion.entries()]
    .sort((x, y) => order(x[0]) - order(y[0]) || x[0].localeCompare(y[0], "da"))
    .map(([region, list]) => ({ region, areas: [...list].sort((p, q) => p.name.localeCompare(q.name, "da")) }));
}

export function formatHa(ha: number | null | undefined): string {
  if (ha == null) return "";
  if (ha < 1) return "under 1 ha";
  return `${Math.round(ha).toLocaleString("da-DK")} ha`;
}

export function summarize(areas: FriTeltningArea[]): { count: number; totalHa: number; kommuner: number } {
  return {
    count: areas.length,
    totalHa: Math.round(areas.reduce((s, a) => s + (a.ha ?? 0), 0)),
    kommuner: new Set(areas.map((a) => a.kommune).filter(Boolean)).size,
  };
}
