import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin(req: NextRequest): SupabaseClient | null {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

const FIELDS = [
  "slug", "title", "intro", "body_md", "seo_title", "seo_description",
  "faq", "sources", "author", "parent_slug", "status", "last_reviewed_at",
] as const;

/** GET — alle guider (inkl. draft). */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb.from("stay_guides").select("*").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guides: data ?? [] });
}

/** POST — opret/opdatér guide. Med id => update, uden => insert. */
export async function POST(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.slug !== "string" || typeof body.title !== "string") {
    return NextResponse.json({ error: "slug, title påkrævet" }, { status: 400 });
  }
  const row: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) row[f] = body[f];

  if (typeof body.id === "number") {
    const { data, error } = await sb.from("stay_guides").update(row).eq("id", body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guide: data });
  }
  const { data, error } = await sb.from("stay_guides").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guide: data });
}

/** DELETE — { id }. Entries fjernes via on delete cascade. */
export async function DELETE(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "number") return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  const { error } = await sb.from("stay_guides").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
