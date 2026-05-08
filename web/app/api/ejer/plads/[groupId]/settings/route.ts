import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getAuthenticatedOwnerGroupContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const context = await getAuthenticatedOwnerGroupContext(groupId);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, number | string | null> = {};

  if ("shelter_price_dkk" in body) {
    const raw = body.shelter_price_dkk;
    const priceDkk = raw === null || raw === "" ? null : Number(raw);
    if (priceDkk !== null && (isNaN(priceDkk) || priceDkk < 0)) {
      return NextResponse.json({ error: "Ugyldig pris" }, { status: 400 });
    }
    updates.shelter_price_dkk = priceDkk;
  }

  if ("platform_fee_pct" in body) {
    const feePct = Number(body.platform_fee_pct);
    if (isNaN(feePct) || feePct < 0 || feePct > 100) {
      return NextResponse.json({ error: "Ugyldigt procentgebyr" }, { status: 400 });
    }
    updates.platform_fee_pct = feePct;
  }

  if ("platform_fee_min_dkk" in body) {
    const feeMinDkk = Number(body.platform_fee_min_dkk);
    if (isNaN(feeMinDkk) || feeMinDkk < 0) {
      return NextResponse.json({ error: "Ugyldigt minimumsgebyr" }, { status: 400 });
    }
    updates.platform_fee_min_dkk = feeMinDkk;
  }

  if ("payment_mode" in body) {
    const paymentMode = body.payment_mode;
    if (paymentMode !== "after_confirmation" && paymentMode !== "upfront") {
      return NextResponse.json({ error: "Ugyldig betalingsmodel" }, { status: 400 });
    }
    updates.payment_mode = paymentMode;
  }

  if ("cancellation_cutoff_hours" in body) {
    const cutoffHours = Number(body.cancellation_cutoff_hours);
    if (!Number.isInteger(cutoffHours) || cutoffHours < 0) {
      return NextResponse.json({ error: "Ugyldig aflysningsfrist" }, { status: 400 });
    }
    updates.cancellation_cutoff_hours = cutoffHours;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ingen gyldige felter at gemme" }, { status: 400 });
  }

  const unitIds = context.shelters.map((s) => s.id);
  const { error } = await createAdminClient()
    .from("bookable_shelters")
    .update(updates)
    .in("id", unitIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updatedCount: unitIds.length });
}
