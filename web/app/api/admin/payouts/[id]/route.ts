import { NextRequest, NextResponse } from "next/server";
import { markPayoutPaid } from "@/lib/payment-db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await markPayoutPaid(id, body.notes ?? null);
  return NextResponse.json({ ok: true });
}
