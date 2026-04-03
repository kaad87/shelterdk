import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";

function parseNum(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/map/shelters?nord=&syd=&ost=&vest=
 * Returnerer shelters inden for bbox via PostGIS RPC (get_shelters_in_bbox).
 * Bruges af kortet ved moveend/zoom for kun at hente synlige markører.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nord = parseNum(searchParams.get("nord"));
  const syd = parseNum(searchParams.get("syd"));
  const ost = parseNum(searchParams.get("ost"));
  const vest = parseNum(searchParams.get("vest"));

  if (
    nord == null ||
    syd == null ||
    ost == null ||
    vest == null ||
    syd >= nord ||
    vest >= ost
  ) {
    return Response.json(
      { error: "Mangler eller ugyldig bbox (nord, syd, ost, vest)" },
      { status: 400 }
    );
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_shelters_in_bbox", {
    p_nord: nord,
    p_syd: syd,
    p_ost: ost,
    p_vest: vest,
  });

  if (error) {
    console.error("Supabase RPC get_shelters_in_bbox:", error);
    return Response.json(
      { error: "Kunne ikke hente shelters i området" },
      { status: 500 }
    );
  }

  const shelters = (data ?? []) as Shelter[];
  return Response.json({ shelters }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
