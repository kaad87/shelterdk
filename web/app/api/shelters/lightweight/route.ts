import { NextResponse } from "next/server";
import { fetchAllShelterRows } from "@/lib/supabase-pagination";

interface ShelterRow {
  id: string;
  title: string;
  slug: string;
  location: string | null;
}

/**
 * GET /api/shelters/lightweight
 * Returns all non-duplicate shelters with id, title, slug, lat, lon.
 * Used by the GPX upload feature to match shelters near a route.
 * Response is ~50-100 KB and should be cached client-side.
 */
export async function GET() {
  let data: ShelterRow[];
  try {
    data = await fetchAllShelterRows<ShelterRow>(
      "id, title, slug, location",
      (query) => query.not("location", "is", null)
    );
  } catch (error) {
    console.error("Lightweight shelters fetch error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente shelters" },
      { status: 500 }
    );
  }

  const shelters = data
    .map((s) => {
      if (!s.location) return null;
      // Parse POINT(lon lat) format
      const match = s.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (!match) return null;
      const lon = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { id: s.id, title: s.title, slug: s.slug, lat, lon };
    })
    .filter(Boolean);

  return NextResponse.json(
    { shelters },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
