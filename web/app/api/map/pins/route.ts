import { NextRequest } from "next/server";
import { getShelterPins, type SoegFilters } from "@/lib/soeg-db";
import { normalizeRegionFilter } from "@/lib/soeg-filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/pins?region=&q=&toilet=1&...
 * ALLE shelters der matcher søgning/filtre — som slanke pins til kortet
 * (id, slug, titel, region, kommune, billede, koordinat). Kortet var før
 * begrænset til listens første side (200), så landsvisningen viste kun en
 * brøkdel af de ~1.700 shelters.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = normalizeRegionFilter(searchParams.get("region")?.trim() ?? null);
  const q = searchParams.get("q")?.trim() || null;

  const filters: SoegFilters = {};
  if (searchParams.get("anmeldelser") === "1") filters.anmeldelser = true;
  if (searchParams.get("vand") === "1") filters.vand = true;
  if (searchParams.get("toilet") === "1") filters.toilet = true;
  if (searchParams.get("hund") === "1") filters.hund = true;
  if (searchParams.get("baalplads") === "1") filters.baalplads = true;
  if (searchParams.get("handicap") === "1") filters.handicap = true;
  if (searchParams.get("bord_baenk") === "1") filters.bord_baenk = true;
  if (searchParams.get("strand") === "1") filters.strand = true;
  if (searchParams.get("bruser") === "1") filters.bruser = true;
  const minPladser = parseInt(searchParams.get("min_pladser") ?? "0", 10);
  if (minPladser > 0) filters.min_pladser = minPladser;

  const pins = await getShelterPins(region, q, Object.keys(filters).length ? filters : null);

  return Response.json(
    { pins },
    {
      headers: {
        // Pins ændrer sig sjældent — lad CDN'en bære gentagne kald.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        // Netlify cacher funktions-svar UDEN query-params i nøglen som
        // default — uden denne header fik ?hund=1 serveret det ufiltrerede
        // svar fra cachen.
        "Netlify-Vary": "query",
      },
    }
  );
}
