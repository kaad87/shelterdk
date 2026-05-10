import { NextRequest, NextResponse } from "next/server";
import { blockDate, unblockDate, hasConfirmedOverlap } from "@/lib/booking-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";
const MAX_BLOCK_DAYS = 366;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIsoDateExact(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const from: string = body.from ?? body.date ?? "";
  const to: string = body.to ?? from;
  const unblock: boolean = body.unblock === true;
  const reason: string | null = body.reason ?? null;

  const fromDate = parseIsoDateExact(from);
  const toDate = parseIsoDateExact(to);
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "Ugyldig dato" }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: "Slutdato må ikke være før startdato" }, { status: 400 });
  }

  const dates: string[] = [];
  const cur = new Date(fromDate);
  const end = new Date(toDate);
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
    const overlapsConfirmed = await hasConfirmedOverlap(
      context.shelter.id,
      from,
      addDays(to, 1)
    );
    if (overlapsConfirmed) {
      return NextResponse.json(
        { error: "Kan ikke blokere datoer med en eksisterende bekræftet booking" },
        { status: 409 }
      );
    }
  }

  for (const date of dates) {
    await (unblock
      ? unblockDate(context.shelter.id, date)
      : blockDate(context.shelter.id, date, reason));
  }

  return NextResponse.json({ ok: true, blocked: dates.length });
}
