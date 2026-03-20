import { NextRequest } from "next/server";
import { getSheltersPage, SOEG_PAGE_SIZE, type SoegFilters, type SoegSort, type MapBbox } from "@/lib/soeg-db";
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
  if (searchParams.get("vand") === "1") filters.vand = true;
  if (searchParams.get("toilet") === "1") filters.toilet = true;
  if (searchParams.get("hund") === "1") filters.hund = true;
  if (searchParams.get("baalplads") === "1") filters.baalplads = true;
  if (searchParams.get("gratis") === "1") filters.gratis = true;
  if (searchParams.get("handicap") === "1") filters.handicap = true;
  if (searchParams.get("bord_baenk") === "1") filters.bord_baenk = true;
  if (searchParams.get("strand") === "1") filters.strand = true;
  if (searchParams.get("bruser") === "1") filters.bruser = true;

  const minLat = parseNum(searchParams.get("minLat"));
  const maxLat = parseNum(searchParams.get("maxLat"));
  const minLon = parseNum(searchParams.get("minLon"));
  const maxLon = parseNum(searchParams.get("maxLon"));
  const bbox: MapBbox | undefined =
    minLat != null && maxLat != null && minLon != null && maxLon != null
      ? { minLat, maxLat, minLon, maxLon }
      : undefined;

  // UX: Når brugeren panorerer/zoomer på kortet, skal resultater følge det synlige område,
  // også hvis der tidligere var valgt region-filter (fx “Aarhus”). Derfor ignorerer vi region
  // for bbox-forespørgsler.
  const regionForQuery = bbox ? null : region;
  const sortParam = searchParams.get("sort") as SoegSort | null;
  const sort: SoegSort | undefined = (sortParam === "rating" || sortParam === "reviews") ? sortParam : undefined;
  const limitParam = parseInt(searchParams.get("limit") ?? "0", 10);
  const pageSize = (limitParam > 0 && limitParam <= 500) ? limitParam : SOEG_PAGE_SIZE;

  let { shelters, hasMore } = await getSheltersPage(
    regionForQuery,
    q,
    page,
    pageSize,
    Object.keys(filters).length ? filters : undefined,
    bbox,
    area,
    sort
  );

  if (region && !bbox) shelters = filterSheltersByRegion(shelters, region);
  shelters = await enrichSheltersWithGooglePhotoRef(shelters);

  return Response.json({ shelters, hasMore });
}
