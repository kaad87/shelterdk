import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { normalizeInstagramPostUrl } from "@/lib/instagram-url";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * POST /api/admin/instagram-submit
 * Body: { postUrl: string }
 * Opretter pending række (upsert på URL).
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { postUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const normalized = normalizeInstagramPostUrl(body.postUrl ?? "");
  if (!normalized) {
    return Response.json(
      { error: "Ugyldig Instagram-URL. Brug et opslag: instagram.com/p/..., /reel/... eller /tv/..." },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("instagram_posts")
      .select("id, post_url, status, created_at, reviewed_at")
      .eq("post_url", normalized)
      .maybeSingle();

    if (existing) {
      return Response.json({
        ok: true,
        post: existing,
        message:
          existing.status === "approved"
            ? "Dette opslag er allerede godkendt."
            : "Dette opslag findes allerede i køen.",
      });
    }

    const { data, error } = await supabase
      .from("instagram_posts")
      .insert({
        post_url: normalized,
        status: "pending",
      })
      .select("id, post_url, status, created_at")
      .single();

    if (error) {
      if (String(error.message || "").includes("instagram_posts")) {
        return Response.json(
          { error: "instagram_posts-tabellen findes ikke. Kør migration 030 i Supabase." },
          { status: 503 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
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
