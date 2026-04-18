import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILES = 4;
const BUCKET = "experience-photos";

/**
 * POST /api/experiences/upload-url
 * Body: { fileCount: number }  (1–4)
 *
 * Returns presigned upload URLs for each file plus the pre-allocated
 * experience UUID that must be passed to POST /api/experiences.
 */
export async function POST(request: NextRequest) {
  let body: { fileCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const fileCount = Number(body.fileCount);
  if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > MAX_FILES) {
    return Response.json(
      { error: `fileCount skal være 1–${MAX_FILES}` },
      { status: 400 }
    );
  }

  const experienceId = randomUUID();
  const supabase = createAdminClient();
  const storage = supabase.storage.from(BUCKET);

  const uploads: { index: number; signedUrl: string; token: string; path: string }[] = [];

  for (let i = 0; i < fileCount; i++) {
    const path = `${experienceId}/${i}.webp`;
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
    if (error || !data) {
      return Response.json(
        { error: "Kunne ikke oprette upload-URL: " + (error?.message ?? "ukendt fejl") },
        { status: 500 }
      );
    }
    // Expose token — required for uploadToSignedUrl on the client
    uploads.push({ index: i, signedUrl: data.signedUrl, token: data.token, path });
  }

  return Response.json({ experienceId, uploads });
}
