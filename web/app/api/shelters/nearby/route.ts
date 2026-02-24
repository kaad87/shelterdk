import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import { slugifySegment } from "@/lib/slug";

const NO_KOMMUNE_SLUG = "ukendt-kommune";
const NEARBY_LIMIT = 10;

function parseNum(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Parse DB location (POINT(lon lat) eller GeoJSON) til { lat, lon }. */
function parseLocation(loc: unknown): { lat: number; lon: number } | null {
  if (!loc) return null;
  if (typeof loc === "object" && loc !== null && "coordinates" in loc) {
    const c = (loc as { coordinates: number[] }).coordinates;
    if (Array.isArray(c) && c.length >= 2) return { lon: c[0], lat: c[1] };
  }
  if (typeof loc === "string") {
    const m = loc.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i);
    if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}

/** Haversine: afstand i km mellem to punkter (WGS84). */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Jordens radius i km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearbyShelterItem {
  title: string;
  slug: string;
  path: string;
  distance_km: number;
  region: string | null;
  kommune: string | null;
}

/**
 * GET /api/shelters/nearby?lat=55.67&lng=12.56
 * Returnerer de 10 nærmeste shelters (Haversine) med distance_km og canonical path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseNum(searchParams.get("lat"));
  const lng = parseNum(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return Response.json(
      { error: "Mangler lat eller lng i query" },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { error: "Ugyldige koordinater" },
      { status: 400 }
    );
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("title, slug, location, region, kommune")
    .is("duplicate_of_shelter_id", null)
    .not("location", "is", null);

  if (error) {
    console.error("Supabase error (shelters nearby):", error);
    return Response.json(
      { error: "Kunne ikke hente shelters" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as {
    title: string | null;
    slug: string;
    location: unknown;
    region: string | null;
    kommune: string | null;
  }[];

  const withDistance: (typeof rows[0] & { lat: number; lon: number; distance_km: number })[] = [];

  for (const row of rows) {
    const coords = parseLocation(row.location);
    if (!coords) continue;
    const distance_km = haversineKm(lat, lng, coords.lat, coords.lon);
    withDistance.push({
      ...row,
      lat: coords.lat,
      lon: coords.lon,
      distance_km,
    });
  }

  withDistance.sort((a, b) => a.distance_km - b.distance_km);
  const top = withDistance.slice(0, NEARBY_LIMIT);

  const regionTrim = (s: string | null) => (s && s.trim()) || null;
  const result: NearbyShelterItem[] = top.map((row) => {
    const region = regionTrim(row.region);
    const kommune = regionTrim(row.kommune);
    const regionSlug = slugifySegment(region);
    const kommuneSlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    const path =
      region && regionSlug
        ? `/danmark/${regionSlug}/${kommuneSlug}/${row.slug}`
        : `/shelter/${row.slug}`;
    return {
      title: row.title?.trim() || "Shelter",
      slug: row.slug,
      path,
      distance_km: Math.round(row.distance_km * 10) / 10,
      region,
      kommune,
    };
  });

  return Response.json({ shelters: result });
}
