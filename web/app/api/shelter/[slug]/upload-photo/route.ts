import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-photos";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * POST /api/shelter/[slug]/upload-photo
 * Body: FormData med "file" (billedfil) og valgfrit "email".
 * Uploader til Storage pending/ og opretter række i shelter_photo_submissions.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = createPublicClient();

  const { data: shelter } = await supabase
    .from("shelters")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!shelter?.id) {
    return Response.json(
      { error: "Shelter ikke fundet" },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const email = (formData.get("email") as string)?.trim() || null;

  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: "Vælg et billede (JPEG, PNG eller WebP)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return Response.json(
      { error: "Kun JPEG, PNG og WebP understøttes" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: "Billedet må højst være 5 MB" },
      { status: 400 }
    );
  }

  const ext = EXT[file.type] ?? "jpg";
  const filePath = `pending/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return Response.json(
      { error: "Kunne ikke uploade billedet. Prøv igen eller kontakt os." },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabase
    .from("shelter_photo_submissions")
    .insert({
      shelter_id: shelter.id,
      file_path: filePath,
      storage_bucket: BUCKET,
      submitter_email: email || null,
      status: "pending",
    });

  if (insertError) {
    console.error("Submission insert error:", insertError);
    return Response.json(
      { error: "Billedet blev uploadet, men kunne ikke registreres. Kontakt os." },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    message: "Tak! Billedet er sendt til godkendelse og vil blive vist, når det er godkendt.",
  });
}
