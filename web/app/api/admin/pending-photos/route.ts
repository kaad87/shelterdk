import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * GET /api/admin/pending-photos?secret=... eller med header x-admin-secret
 * Returnerer alle submissions med status pending inkl. shelter-titel og slug.
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelter_photo_submissions")
    .select(
      "id, shelter_id, file_path, storage_bucket, submitter_email, status, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
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

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const submissions = (data || []).map((row) => ({
    ...row,
    shelter: shelterMap.get(row.shelter_id) ?? null,
    image_url:
      baseUrl && row.storage_bucket && row.file_path
        ? `${baseUrl}/storage/v1/object/public/${row.storage_bucket}/${row.file_path}`
        : null,
  }));

  return Response.json({ submissions });
}
