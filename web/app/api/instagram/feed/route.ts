import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

/**
 * GET /api/instagram/feed?limit=12
 * Returnerer godkendte Instagram-post-URL'er til widget (offentlig).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("id, post_url, reviewed_at, created_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (String(error.message || "").includes("instagram_posts")) {
      return Response.json({ posts: [], setupRequired: true });
    }
    console.error("instagram feed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [] });
}
