import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shelters: data });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { slug, title, owner_email, max_persons, description, shelter_id, booking_mode, payment_mode, shelter_price_dkk, platform_fee_pct, platform_fee_min_dkk } = body;

  if (!slug || !title || !owner_email)
    return NextResponse.json(
      { error: "slug, title og owner_email er påkrævet" },
      { status: 400 }
    );

  const { data, error } = await createAdminClient()
    .from("bookable_shelters")
    .insert({
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      owner_email: owner_email.trim().toLowerCase(),
      max_persons: Number(max_persons) || 6,
      description: description?.trim() || null,
      shelter_id: shelter_id || null,
      booking_mode: (["shelterdk", "iframe", "both"] as const).includes(booking_mode) ? booking_mode : "iframe",
      payment_mode: payment_mode === "upfront" ? "upfront" : "after_confirmation",
      shelter_price_dkk: shelter_price_dkk ? Number(shelter_price_dkk) : null,
      platform_fee_pct: platform_fee_pct != null ? Number(platform_fee_pct) : 5,
      platform_fee_min_dkk: platform_fee_min_dkk != null ? Number(platform_fee_min_dkk) : 25,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message.includes("unique")
      ? `Slug "${slug}" er allerede i brug`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ shelter: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id påkrævet" }, { status: 400 });

  await createAdminClient().from("bookable_shelters").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
