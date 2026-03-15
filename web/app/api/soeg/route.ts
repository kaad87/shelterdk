import { NextRequest } from "next/server";
import { getSheltersPage, SOEG_PAGE_SIZE, type SoegFilters, type MapBbox } from "@/lib/soeg-db";
import { filterSheltersByRegion } from "@/lib/soeg-filters";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";

export const dynamic = "force-dynamic";

function parseNum(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/soeg?page=2&region=...&q=...&billede=1&anmeldelser=1&bookbar=1
 * Eller med kort-bbox: minLat=&maxLat=&minLon=&maxLon= (finder shelters i det synlige område).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const region = searchParams.get("region")?.trim() ?? null;
  const q = searchParams.get("q")?.trim() ?? null;
  const area = searchParams.get("area")?.trim() ?? null;
  const filters: SoegFilters = {};
  if (searchParams.get("billede") === "1") filters.billede = true;
  if (searchParams.get("anmeldelser") === "1") filters.anmeldelser = true;
  if (searchParams.get("bookbar") === "1") filters.bookbar = true;

  const minLat = parseNum(searchParams.get("minLat"));
  const maxLat = parseNum(searchParams.get("maxLat"));
  const minLon = parseNum(searchParams.get("minLon"));
  const maxLon = parseNum(searchParams.get("maxLon"));
  const bbox: MapBbox | undefined =
    minLat != null && maxLat != null && minLon != null && maxLon != null
      ? { minLat, maxLat, minLon, maxLon }
      : undefined;

  let { shelters, hasMore } = await getSheltersPage(
    region,
    q,
    page,
    SOEG_PAGE_SIZE,
    Object.keys(filters).length ? filters : undefined,
    bbox,
    area
  );

  if (region) shelters = filterSheltersByRegion(shelters, region);
  shelters = await enrichSheltersWithGooglePhotoRef(shelters);

  return Response.json({ shelters, hasMore });
}
