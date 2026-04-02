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
