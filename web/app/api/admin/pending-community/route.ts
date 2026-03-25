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
 * GET /api/admin/pending-community
 * Returnerer alle pending kommentarer og facilities-opdateringer.
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("community_submissions")
    .select(
      "id, shelter_id, type, payload, status, submitter_name, submitter_email, created_at"
    )
    .eq("status", "pending")
    .in("type", ["comment", "facilities_update"])
    .order("created_at", { ascending: false });

  if (error) {
    // Graceful fallback in environments where migration isn't applied yet.
    if (String(error.message || "").includes("community_submissions")) {
      return Response.json({ submissions: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return Response.json({ submissions: [] });
  }

  const shelterIds = [...new Set(data.map((r) => r.shelter_id))];
  const { data: shelters } = await supabase
    .from("shelters")
    .select("id, title, slug")
    .in("id", shelterIds);

  const shelterMap = new Map(
    (shelters || []).map((s) => [s.id, { title: s.title, slug: s.slug }])
  );

  const submissions = (data || []).map((row) => ({
    ...row,
    shelter: shelterMap.get(row.shelter_id) ?? null,
  }));

  return Response.json({ submissions });
}
