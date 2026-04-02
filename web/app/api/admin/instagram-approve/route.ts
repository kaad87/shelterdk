import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * POST /api/admin/instagram-approve
 * Body: { id: string }
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) return Response.json({ error: "Mangler id" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("instagram_posts")
      .update({ status: "approved", reviewed_at: now, moderation_note: null })
      .eq("id", id)
      .in("status", ["pending", "rejected"])
      .select("id, post_url, status, reviewed_at")
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return Response.json({ error: "Ikke fundet eller allerede godkendt" }, { status: 404 });
    }

    return Response.json({ ok: true, post: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ error: "Admin ikke konfigureret" }, { status: 503 });
    }
    throw e;
  }
}
