import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, blockDate, unblockDate } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date: string = body.date ?? "";
  const unblock: boolean = body.unblock === true;
  const reason: string | null = body.reason ?? null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Ugyldig dato" }, { status: 400 });

  if (unblock) {
    await unblockDate(shelter.id, date);
  } else {
    await blockDate(shelter.id, date, reason);
  }
  return NextResponse.json({ ok: true });
}
