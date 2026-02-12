import { NextRequest } from "next/server";
import { getSheltersPage, SOEG_PAGE_SIZE, type SoegFilters } from "@/lib/soeg-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/soeg?page=2&region=...&q=...&billede=1&anmeldelser=1&bookbar=1
 * Returnerer næste side shelters til infinite scroll.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const region = searchParams.get("region")?.trim() ?? null;
  const q = searchParams.get("q")?.trim() ?? null;
  const filters: SoegFilters = {};
  if (searchParams.get("billede") === "1") filters.billede = true;
  if (searchParams.get("anmeldelser") === "1") filters.anmeldelser = true;
  if (searchParams.get("bookbar") === "1") filters.bookbar = true;

  const { shelters, hasMore } = await getSheltersPage(
    region,
    q,
    page,
    SOEG_PAGE_SIZE,
    Object.keys(filters).length ? filters : undefined
  );

  return Response.json({ shelters, hasMore });
}
