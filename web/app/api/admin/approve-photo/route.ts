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
 * POST /api/admin/approve-photo
 * Body: { submissionId: string }
 * Sætter submission til approved og tilføjer billedets URL til shelters.user_image_urls.
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { submissionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    return Response.json({ error: "Mangler submissionId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const { data: sub, error: subError } = await supabase
    .from("shelter_photo_submissions")
    .select("id, shelter_id, file_path, storage_bucket, status")
    .eq("id", submissionId)
    .single();

  if (subError || !sub) {
    return Response.json({ error: "Submission ikke fundet" }, { status: 404 });
  }
  if (sub.status !== "pending") {
    return Response.json({ error: "Submission er allerede behandlet" }, { status: 400 });
  }

  const imageUrl =
    baseUrl && sub.storage_bucket && sub.file_path
      ? `${baseUrl}/storage/v1/object/public/${sub.storage_bucket}/${sub.file_path}`
      : null;

  if (!imageUrl) {
    return Response.json({ error: "Kunne ikke danne billed-URL" }, { status: 500 });
  }

  const { data: shelter } = await supabase
    .from("shelters")
    .select("user_image_urls")
    .eq("id", sub.shelter_id)
    .single();

  const existing = (shelter?.user_image_urls as string[] | null) ?? [];
  const nextUrls = Array.isArray(existing) ? [...existing, imageUrl] : [imageUrl];

  const { error: updateShelterError } = await supabase
    .from("shelters")
    .update({ user_image_urls: nextUrls })
    .eq("id", sub.shelter_id);

  if (updateShelterError) {
    return Response.json(
      { error: "Kunne ikke opdatere shelter: " + updateShelterError.message },
      { status: 500 }
    );
  }

  const { error: updateSubError } = await supabase
    .from("shelter_photo_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (updateSubError) {
    return Response.json(
      { error: "Shelter opdateret, men submission ikke: " + updateSubError.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
