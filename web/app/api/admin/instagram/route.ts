import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * GET /api/admin/instagram
 * Lister alle instagram_posts til moderation (kræver admin).
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("instagram_posts")
      .select("id, post_url, status, moderation_note, created_at, reviewed_at")
      .order("created_at", { ascending: false });

    if (error) {
      if (String(error.message || "").includes("instagram_posts")) {
        return Response.json({ posts: [], setupRequired: true });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ posts: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ error: "Admin ikke konfigureret (mangler service role)" }, { status: 503 });
    }
    throw e;
  }
}
