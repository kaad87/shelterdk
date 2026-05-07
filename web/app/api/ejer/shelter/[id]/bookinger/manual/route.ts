import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/booking-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function toIsoDate(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const guestName = typeof body.guest_name === "string" ? body.guest_name.trim() : "";
  const guestEmailRaw = typeof body.guest_email === "string" ? body.guest_email.trim().toLowerCase() : "";
  const guestCount = Number(body.guest_count);
  const checkIn = toIsoDate(body.check_in);
  const checkOut = toIsoDate(body.check_out);
  const note = typeof body.message === "string" ? body.message.trim() : "";

  if (!guestName) {
    return NextResponse.json({ error: "Navn er påkrævet" }, { status: 400 });
  }
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: "Ugyldige datoer" }, { status: 400 });
  }
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > context.shelter.max_persons) {
    return NextResponse.json(
      { error: `Antal personer skal være mellem 1 og ${context.shelter.max_persons}` },
      { status: 400 }
    );
  }
  if (guestEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmailRaw)) {
    return NextResponse.json({ error: "Email er ugyldig" }, { status: 400 });
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: "Note må højst være 2000 tegn" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: overlapRows, error: overlapError } = await admin
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", context.shelter.id)
    .in("status", ["pending", "confirmed"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);
  if (overlapError) {
    return NextResponse.json({ error: "Kunne ikke kontrollere overlap" }, { status: 500 });
  }
  if ((overlapRows?.length ?? 0) > 0) {
    return NextResponse.json({ error: "Datoerne overlapper en eksisterende booking" }, { status: 409 });
  }

  const { data: blockedRows, error: blockedError } = await admin
    .from("shelter_blocked_dates")
    .select("blocked_date")
    .eq("bookable_shelter_id", context.shelter.id)
    .gte("blocked_date", checkIn)
    .lt("blocked_date", checkOut)
    .limit(1);
  if (blockedError) {
    return NextResponse.json({ error: "Kunne ikke kontrollere blokerede datoer" }, { status: 500 });
  }
  if ((blockedRows?.length ?? 0) > 0) {
    return NextResponse.json({ error: "Datoerne overlapper blokerede dage i kalenderen" }, { status: 409 });
  }

  const guestEmail =
    guestEmailRaw ||
    `manual+${context.shelter.id.slice(0, 8)}-${Date.now()}@placeholder.shelterdk.local`;

  const booking = await createBooking({
    bookable_shelter_id: context.shelter.id,
    guest_name: guestName,
    guest_email: guestEmail,
    guest_count: guestCount,
    check_in: checkIn,
    check_out: checkOut,
    message: note || null,
    status: "confirmed",
    source: "owner_manual",
  });

  return NextResponse.json({ ok: true, booking }, { status: 201 });
}
