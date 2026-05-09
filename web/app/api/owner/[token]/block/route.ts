import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, blockDate, unblockDate, hasConfirmedOverlap } from "@/lib/booking-db";

export const dynamic = "force-dynamic";
const MAX_BLOCK_DAYS = 366;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  if (dates.length > MAX_BLOCK_DAYS) {
    return NextResponse.json(
      { error: `Du kan højst blokere ${MAX_BLOCK_DAYS} dage ad gangen` },
      { status: 400 }
    );
  }

  if (!unblock) {
    const overlapsConfirmed = await hasConfirmedOverlap(shelter.id, from, addDays(to, 1));
    if (overlapsConfirmed) {
      return NextResponse.json(
        { error: "Kan ikke blokere datoer med en eksisterende bekræftet booking" },
        { status: 409 }
      );
    }
  }

  for (const date of dates) {
    await (unblock ? unblockDate(shelter.id, date) : blockDate(shelter.id, date, reason));
  }
  return NextResponse.json({ ok: true, blocked: dates.length });
}
