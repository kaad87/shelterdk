// app/api/submit-shelter/photos/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-submissions";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

// Rate limiting: 10 uploads/min per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const ipTimestamps = new Map<string, number[]>();

export async function POST(request: Request) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange uploads. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  // File size guard via Content-Length header
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SIZE_BYTES * 2) {
    // *2 for multipart overhead
    return Response.json({ error: "Filen er for stor (maks 5 MB)" }, { status: 413 });
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Ugyldig formdata" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Mangler fil-felt 'file'" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return Response.json(
      { error: "Kun JPEG og PNG understøttes" },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Filen er for stor (maks 5 MB)" }, { status: 400 });
  }

  const ext = EXT[file.type] ?? "jpg";
  const fileId = crypto.randomUUID();
  const storagePath = `pending/${fileId}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Submission photo upload error:", uploadError);
    return Response.json({ error: "Upload fejlede — prøv igen" }, { status: 500 });
  }

  // Signed URL for thumbnail preview (60 min TTL)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    console.error("Signed URL error:", signedError);
    // Upload succeeded — return path even without preview URL
    return Response.json({ path: storagePath, previewUrl: null });
  }

  return Response.json({ path: storagePath, previewUrl: signedData.signedUrl });
}
