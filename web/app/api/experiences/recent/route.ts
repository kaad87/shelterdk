import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

/**
 * GET /api/experiences/recent?limit=8
 * Returns the most recent approved experiences across all shelters,
 * joined with shelter title and slug for the homepage feed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 20);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at, shelter:shelters(title, slug)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ experiences: [] });
  }

  return Response.json({ experiences: data ?? [] });
}
