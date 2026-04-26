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
  const from: string = body.from ?? body.date ?? "";
  const to: string = body.to ?? from;
  const unblock: boolean = body.unblock === true;
  const reason: string | null = body.reason ?? null;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(from) || !dateRe.test(to))
    return NextResponse.json({ error: "Ugyldig dato" }, { status: 400 });
  if (to < from)
    return NextResponse.json({ error: "Slutdato må ikke være før startdato" }, { status: 400 });

  // Expand range to individual dates
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  await Promise.all(
    dates.map((d) => unblock ? unblockDate(shelter.id, d) : blockDate(shelter.id, d, reason))
  );
  return NextResponse.json({ ok: true, blocked: dates.length });
}
