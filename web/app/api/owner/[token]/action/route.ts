import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import { sendBookingConfirmedToGuest, sendBookingRejectedToGuest } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bookingId: string = body.booking_id ?? "";
  const action: string = body.action ?? "";

  if (!bookingId || (action !== "confirm" && action !== "reject"))
    return NextResponse.json({ error: "Ugyldige parametre" }, { status: 400 });

  // Verify booking belongs to this shelter (direct lookup — no full scan)
  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  if (booking.status !== "pending")
    return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

  if (action === "confirm") {
    const conflict = await hasConfirmedOverlap(
      shelter.id, booking.check_in, booking.check_out, bookingId
    );
    if (conflict)
      return NextResponse.json(
        { error: "En anden bekræftet booking overlapper disse datoer" },
        { status: 409 }
      );
  }

  await updateBookingStatus(bookingId, action === "confirm" ? "confirmed" : "rejected");

  try {
    if (action === "confirm") {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    } else {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    }
  } catch (err) {
    console.error("owner action email error:", err);
  }

  return NextResponse.json({ ok: true });
}
