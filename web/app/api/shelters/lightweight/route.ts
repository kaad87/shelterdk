import { createPublicClient } from "@/utils/supabase/server-public";
import { NextResponse } from "next/server";

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
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("shelters")
    .select("id, title, slug, location")
    .is("duplicate_of_shelter_id", null)
    .not("location", "is", null);

  if (error) {
    console.error("Lightweight shelters fetch error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente shelters" },
      { status: 500 }
    );
  }

  const shelters = (data as ShelterRow[])
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
