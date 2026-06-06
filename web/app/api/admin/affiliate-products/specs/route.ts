import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** POST — { id, specs (object), editor_score? } sætter strukturerede specs på et produkt. */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if ("specs" in body) update.specs = body.specs;
  if ("editor_score" in body) update.editor_score = body.editor_score;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "specs eller editor_score påkrævet" }, { status: 400 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await sb.from("affiliate_products").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
