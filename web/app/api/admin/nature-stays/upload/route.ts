import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "nature-stays";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_SIZE = 6 * 1024 * 1024;

function admin(req: NextRequest): SupabaseClient | null {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** POST (multipart) — upload ét billede til nature-stays-bucket, returnér public URL. */
export async function POST(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Vælg en billedfil (JPEG, PNG eller WebP)" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return NextResponse.json({ error: "Kun JPEG, PNG og WebP understøttes" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Billedet må højst være 6 MB" }, { status: 400 });
  }

  const ext = EXT[file.type] ?? "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("nature-stays upload:", upErr);
    return NextResponse.json({ error: "Upload fejlede. Prøv igen." }, { status: 500 });
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
