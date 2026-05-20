// app/api/submit-shelter/photos/route.ts
import { createHmac } from "crypto";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";
import { PHOTO_PATH_REGEX } from "@/lib/shelter-submissions";

export const dynamic = "force-dynamic";

const BUCKET = "shelter-submissions";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Rate limiting: 10 uploads/min per IP (shared across instances via DB)
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 10;

/**
 * Sign a storage path with the server secret so the DELETE endpoint can verify
 * the caller is the same client that performed the upload. Stateless — works
 * across serverless cold-starts.  Domain-prefixed to isolate from ADMIN_SECRET.
 */
function signPath(path: string): string {
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret) {
    throw new Error("ADMIN_SECRET er påkrævet for at signere billedsletninger");
  }
  const secret = `photo-delete:${adminSecret}`;
  return createHmac("sha256", secret).update(path).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  const rateLimited = await enforcePublicRateLimit(request, {
    scope: "submit-shelter-photo-upload",
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxHits: MAX_PER_WINDOW,
    errorMessage: "For mange uploads. Prøv igen om lidt.",
  });
  if (rateLimited) {
    return rateLimited;
  }

  // File size guard via Content-Length header
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SIZE_BYTES * 2) {
    // *2 for multipart overhead
    return Response.json(
      { error: "Filen er for stor (maks 10 MB)" },
      { status: 413 }
    );
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Ugyldig formdata" }, { status: 400 });
  }

  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim()) {
    return Response.json(
      { error: "Upload kunne ikke gennemføres" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Mangler fil-felt 'file'" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return Response.json(
      { error: "Kun JPEG, PNG og WebP understøttes" },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: "Filen er for stor (maks 10 MB)" },
      { status: 400 }
    );
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

  // Signed URL for thumbnail preview (60 min TTL — form is submitted within minutes)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    console.error("Signed URL error:", signedError);
    let deleteToken: string;
    try {
      deleteToken = signPath(storagePath);
    } catch (err) {
      console.error("Delete token signing error:", err);
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => null);
      return Response.json(
        { error: "Upload kunne ikke færdiggøres. Prøv igen." },
        { status: 500 }
      );
    }

    // Upload succeeded — return path even without preview URL
    return Response.json({
      path: storagePath,
      previewUrl: null,
      deleteToken,
    });
  }

  let deleteToken: string;
  try {
    deleteToken = signPath(storagePath);
  } catch (err) {
    console.error("Delete token signing error:", err);
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => null);
    return Response.json(
      { error: "Upload kunne ikke færdiggøres. Prøv igen." },
      { status: 500 }
    );
  }

  return Response.json({
    path: storagePath,
    previewUrl: signedData.signedUrl,
    deleteToken,
  });
}

// ─── DELETE /api/submit-shelter/photos ───────────────────────────────────────
// Called fire-and-forget by the submission form when a user removes an uploaded
// photo before submitting.  Requires a deleteToken (HMAC of the path) returned
// by POST — prevents deletion of arbitrary paths without a token.

export async function DELETE(request: Request) {
  let body: { path?: string; deleteToken?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const path = body.path?.trim();
  if (!path || !PHOTO_PATH_REGEX.test(path)) {
    return Response.json({ error: "Ugyldig sti" }, { status: 400 });
  }

  let expectedToken: string;
  try {
    expectedToken = signPath(path);
  } catch (err) {
    console.error("Delete token validation error:", err);
    return Response.json(
      { error: "Sletning kunne ikke valideres lige nu" },
      { status: 500 }
    );
  }

  if (!body.deleteToken || body.deleteToken !== expectedToken) {
    return Response.json({ error: "Ugyldig token" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error("Submission photo delete error:", error);
    return Response.json({ error: "Sletning fejlede" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
