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

/** GET ?guide_id= — entries for en guide, med tilknyttet sted, sorteret efter rank. */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guideId = Number(req.nextUrl.searchParams.get("guide_id"));
  if (!guideId) return NextResponse.json({ error: "guide_id påkrævet" }, { status: 400 });
  const { data, error } = await sb
    .from("stay_guide_entries")
    .select("id, guide_id, nature_stay_id, rank, award_label, best_for, editorial_note, stay:nature_stays(id, name, image_url, region, price_from, status)")
    .eq("guide_id", guideId)
    .order("rank", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

/** POST — tilføj sted til guide: { guide_id, nature_stay_id, rank }. */
export async function POST(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.guide_id !== "number" || typeof body.nature_stay_id !== "number") {
    return NextResponse.json({ error: "guide_id, nature_stay_id påkrævet" }, { status: 400 });
  }
  const { data, error } = await sb
    .from("stay_guide_entries")
    .insert({ guide_id: body.guide_id, nature_stay_id: body.nature_stay_id, rank: body.rank ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

/** PATCH — opdatér entry: { id, rank?, award_label?, best_for?, editorial_note? }. */
export async function PATCH(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "number") return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  const row: Record<string, unknown> = {};
  for (const f of ["rank", "award_label", "best_for", "editorial_note"] as const) if (f in body) row[f] = body[f];
  const { data, error } = await sb.from("stay_guide_entries").update(row).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

/** DELETE — { id }. */
export async function DELETE(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "number") return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  const { error } = await sb.from("stay_guide_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
