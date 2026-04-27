import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
} from "@/lib/booking-db";
import {
  getMessagesForBooking,
  createMessage,
  markMessagesRead,
  validateMessageBody,
} from "@/lib/messages-db";
import { sendNewMessageToGuest } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string; bookingId: string }> };

/** GET /api/owner/[token]/booking/[bookingId]/messages
 *  Returns all messages for the booking (oldest first).
 *  Marks guest's messages as read (owner is opening the thread). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token, bookingId } = await params;

  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) {
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  }

  await markMessagesRead(booking.id, "guest");
  const messages = await getMessagesForBooking(booking.id);
  return NextResponse.json({ messages });
}

/** POST /api/owner/[token]/booking/[bookingId]/messages
 *  Body: { body: string }
 *  Inserts an owner message, then notifies the guest by email. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token, bookingId } = await params;

  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) {
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    return NextResponse.json(
      { error: "Beskeder er ikke tilgængelige for denne booking" },
      { status: 409 }
    );
  }

  const json = await req.json().catch(() => null);
  const validationError = validateMessageBody(json?.body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const message = await createMessage(booking.id, "owner", json.body as string);

  // Notify guest — non-critical
  try {
    await sendNewMessageToGuest({
      guestEmail: booking.guest_email,
      guestName: booking.guest_name,
      shelterTitle: shelter.title,
      guestToken: booking.guest_token,
      messageBody: json.body as string,
    });
  } catch (err) {
    console.error("owner message: guest email error:", err);
  }

  return NextResponse.json({ message }, { status: 201 });
}
