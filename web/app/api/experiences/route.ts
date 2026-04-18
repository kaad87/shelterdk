import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { CreateExperiencePayload } from "@/lib/experiences";
import { experiencePhotoUrl } from "@/lib/experiences";

export const dynamic = "force-dynamic";

const MAX_AUTHOR_LEN = 60;
const MAX_BODY_LEN = 500;
const MAX_PHOTOS = 4;

/**
 * POST /api/experiences
 * Creates a new experience in pending status.
 */
export async function POST(request: NextRequest) {
  let payload: Partial<CreateExperiencePayload>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const { experienceId, shelter_id, author_name, body, photo_paths, cover_photo_index } = payload;

  if (!experienceId || !shelter_id || !author_name || !body || !photo_paths) {
    return Response.json({ error: "Mangler påkrævede felter" }, { status: 400 });
  }
  if (typeof author_name !== "string" || author_name.trim().length === 0 || author_name.length > MAX_AUTHOR_LEN) {
    return Response.json({ error: "Ugyldigt forfatternavn" }, { status: 400 });
  }
  if (typeof body !== "string" || body.trim().length === 0 || body.length > MAX_BODY_LEN) {
    return Response.json({ error: "Tekst er for lang (maks 500 tegn)" }, { status: 400 });
  }
  if (!Array.isArray(photo_paths) || photo_paths.length === 0 || photo_paths.length > MAX_PHOTOS) {
    return Response.json({ error: "Ugyldigt antal billeder" }, { status: 400 });
  }
  const idx = cover_photo_index ?? 0;
  if (typeof idx !== "number" || idx < 0 || idx >= photo_paths.length) {
    return Response.json({ error: "Ugyldigt cover_photo_index" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const photo_urls = photo_paths.map((p: string) => experiencePhotoUrl(supabaseUrl, p));

  const supabase = createAdminClient();
  const { error } = await supabase.from("shelter_experiences").insert({
    id: experienceId,
    shelter_id,
    author_name: author_name.trim(),
    body: body.trim(),
    photo_urls,
    cover_photo_index: idx,
    status: "pending",
  });

  if (error) {
    return Response.json({ error: "Kunne ikke gemme oplevelse: " + error.message }, { status: 500 });
  }

  return Response.json({ ok: true, id: experienceId }, { status: 201 });
}

/**
 * GET /api/experiences?shelter_id=xxx[&limit=10]
 * Returns approved experiences for a shelter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shelter_id = searchParams.get("shelter_id");
  if (!shelter_id) {
    return Response.json({ error: "Mangler shelter_id" }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at")
    .eq("shelter_id", shelter_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ experiences: data ?? [] });
}
