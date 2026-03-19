import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import { FACILITY_FIELDS } from "@/lib/community";

export const dynamic = "force-dynamic";

/**
 * GET /api/shelter/[slug]/community-facts
 * Returnerer godkendte community-faciliteter for shelteret.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = createPublicClient();

  const { data: shelter, error: shelterError } = await supabase
    .from("shelters")
    .select("id")
    .eq("slug", slug)
    .single();

  if (shelterError || !shelter?.id) {
    return Response.json({ facts: {} });
  }

  const selectCols = FACILITY_FIELDS.map((f) => f.key).join(", ");
  const { data, error } = await supabase
    .from("shelter_community_facts")
    .select(selectCols)
    .eq("shelter_id", shelter.id)
    .single();

  if (error || !data) {
    return Response.json({ facts: {} });
  }

  return Response.json({ facts: data });
}
