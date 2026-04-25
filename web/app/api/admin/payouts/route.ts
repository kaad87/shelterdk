import { NextRequest, NextResponse } from "next/server";
import { createOwnerPayout, getPayoutsForAdmin } from "@/lib/payment-db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getPayoutsForAdmin());
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { shelter_id, period_start, period_end, amount_dkk } = body;
  if (!shelter_id || !period_start || !period_end || !amount_dkk)
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  await createOwnerPayout({
    shelterId: shelter_id,
    periodStart: period_start,
    periodEnd: period_end,
    amountDkk: Number(amount_dkk),
  });
  return NextResponse.json({ ok: true });
}
