import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** GET — ?guide_id= : entries for en guide (uanset status) + produkt-basics, til admin. */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guideId = new URL(req.url).searchParams.get("guide_id");
  if (!guideId) return NextResponse.json({ error: "guide_id påkrævet" }, { status: 400 });

  const { data: rawEntries, error } = await sb
    .from("buying_guide_entries")
    .select("id, rank, award_label, editorial_note, pros, cons, score, best_for, affiliate_product_id")
    .eq("guide_id", guideId)
    .order("rank", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (rawEntries ?? []).map((e) => e.affiliate_product_id);
  const products = ids.length
    ? (await sb
        .from("affiliate_products")
        .select("id, product_name, brand, retailer, price, in_stock, is_blocked, specs")
        .in("id", ids)).data ?? []
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const entries = (rawEntries ?? []).map((e) => ({ ...e, product: byId.get(e.affiliate_product_id) ?? null }));
  return NextResponse.json({ entries });
}

/** POST — opret/opdatér entry (upsert på guide_id+affiliate_product_id). */
export async function POST(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.guide_id !== "string" || typeof body.affiliate_product_id !== "string") {
    return NextResponse.json({ error: "guide_id, affiliate_product_id påkrævet" }, { status: 400 });
  }
  const row = {
    guide_id: body.guide_id,
    affiliate_product_id: body.affiliate_product_id,
    rank: typeof body.rank === "number" ? body.rank : 0,
    award_label: body.award_label ?? null,
    editorial_note: body.editorial_note ?? null,
    pros: Array.isArray(body.pros) ? body.pros : [],
    cons: Array.isArray(body.cons) ? body.cons : [],
    score: typeof body.score === "number" ? body.score : null,
    best_for: body.best_for ?? null,
  };
  const { data, error } = await sb
    .from("buying_guide_entries")
    .upsert(row, { onConflict: "guide_id,affiliate_product_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

/** PUT — { guide_id, order: id[] } sætter rank efter rækkefølge. */
export async function PUT(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { guide_id, order } = await req.json().catch(() => ({ guide_id: null, order: null }));
  if (typeof guide_id !== "string" || !Array.isArray(order)) {
    return NextResponse.json({ error: "guide_id, order[] påkrævet" }, { status: 400 });
  }
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (typeof id !== "string") continue;
    const { error } = await sb.from("buying_guide_entries").update({ rank: i }).eq("id", id).eq("guide_id", guide_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE — { id }. */
export async function DELETE(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "string") return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  const { error } = await sb.from("buying_guide_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
