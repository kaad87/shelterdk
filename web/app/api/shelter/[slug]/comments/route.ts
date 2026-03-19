import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

/**
 * GET /api/shelter/[slug]/comments
 * Returnerer godkendte community-kommentarer for shelteret.
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
    return Response.json({ comments: [] });
  }

  const { data, error } = await supabase
    .from("shelter_comments")
    .select("id, author_name, comment_text, created_at")
    .eq("shelter_id", shelter.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Comments fetch error:", error);
    return Response.json({ comments: [] });
  }

  return Response.json({ comments: data ?? [] });
}
