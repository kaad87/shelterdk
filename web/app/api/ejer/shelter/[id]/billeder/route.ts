import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  getOwnerShelterById,
  appendShelterPhoto,
  removeShelterPhoto,
  shelterPhotoUrl,
  extractPhotoPath,
  isOwnerPhotoPath,
} from "@/lib/owner-db";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-photos";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  if (!shelter.shelter_id) {
    return NextResponse.json(
      { error: "Sheltet er ikke linket til kataloget — kontakt admin" },
      { status: 400 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vælg et billede" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "Kun JPEG, PNG og WebP understøttes" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Billedet må højst være 5 MB" }, { status: 400 });
  }

  const ext = EXT[file.type] ?? "jpg";
  const filePath = `owner/${shelter.shelter_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await createAdminClient().storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Owner photo upload error:", uploadError);
    return NextResponse.json({ error: "Upload fejlede — prøv igen" }, { status: 500 });
  }

  const url = shelterPhotoUrl(filePath);
  await appendShelterPhoto(shelter.shelter_id, url);

  return NextResponse.json({ ok: true, url, path: filePath });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  if (!shelter.shelter_id) {
    return NextResponse.json({ error: "Sheltet er ikke linket til kataloget" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const url = typeof (body as Record<string, unknown>).url === "string"
    ? (body as Record<string, unknown>).url as string
    : "";

  if (!url) {
    return NextResponse.json({ error: "Mangler url" }, { status: 400 });
  }

  const path = extractPhotoPath(url);
  if (!path || !isOwnerPhotoPath(path, shelter.shelter_id)) {
    return NextResponse.json({ error: "Ikke tilladt at slette dette billede" }, { status: 403 });
  }

  await createAdminClient().storage.from(BUCKET).remove([path]);
  await removeShelterPhoto(shelter.shelter_id, url);

  return NextResponse.json({ ok: true });
}
