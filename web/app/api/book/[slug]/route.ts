import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterBySlug,
  createBooking,
  createActionTokens,
} from "@/lib/booking-db";
import {
  sendBookingRequestToOwner,
  sendBookingReceivedToGuest,
} from "@/lib/booking-email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const guest_name = typeof b.guest_name === "string" ? b.guest_name.trim() : "";
  const guest_email = typeof b.guest_email === "string" ? b.guest_email.trim().toLowerCase() : "";
  const guest_count = typeof b.guest_count === "number" ? b.guest_count : 0;
  const check_in = typeof b.check_in === "string" ? b.check_in.trim() : "";
  const check_out = typeof b.check_out === "string" ? b.check_out.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 500) : null;

  // Validation
  if (!guest_name || guest_name.length > 100)
    return NextResponse.json({ error: "Ugyldigt navn (1–100 tegn)" }, { status: 400 });
  if (!EMAIL_RE.test(guest_email))
    return NextResponse.json({ error: "Ugyldig email" }, { status: 400 });
  if (!Number.isInteger(guest_count) || guest_count < 1 || guest_count > shelter.max_persons)
    return NextResponse.json(
      { error: `Antal skal være 1–${shelter.max_persons}` },
      { status: 400 }
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out))
    return NextResponse.json({ error: "Ugyldigt datoformat (YYYY-MM-DD)" }, { status: 400 });
  if (check_in >= check_out)
    return NextResponse.json({ error: "Afrejsedato skal være efter ankomstdato" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (check_in < today)
    return NextResponse.json({ error: "Ankomstdato kan ikke være i fortiden" }, { status: 400 });

  try {
    const booking = await createBooking({
      bookable_shelter_id: shelter.id,
      guest_name,
      guest_email,
      guest_count,
      check_in,
      check_out,
      message: message || null,
    });

    const { confirmToken, rejectToken } = await createActionTokens(booking.id);

    await Promise.all([
      sendBookingRequestToOwner({
        ownerEmail: shelter.owner_email,
        shelterTitle: shelter.title,
        ownerToken: shelter.owner_token,
        guestName: guest_name,
        guestEmail: guest_email,
        guestCount: guest_count,
        checkIn: check_in,
        checkOut: check_out,
        message: message || null,
        confirmToken,
        rejectToken,
      }),
      sendBookingReceivedToGuest({
        guestEmail: guest_email,
        guestName: guest_name,
        shelterTitle: shelter.title,
        checkIn: check_in,
        checkOut: check_out,
      }),
    ]);

    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 201 });
  } catch (err) {
    console.error("booking create error:", err);
    return NextResponse.json(
      { error: "Noget gik galt. Prøv igen." },
      { status: 500 }
    );
  }
}
