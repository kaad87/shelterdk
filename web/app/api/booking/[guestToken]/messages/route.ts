import { NextRequest, NextResponse } from "next/server";
import { getBookingByGuestToken, getBookableShelterByPk } from "@/lib/booking-db";
import {
  getMessagesForBooking,
  createMessage,
  markMessagesRead,
  validateMessageBody,
} from "@/lib/messages-db";
import { sendNewMessageToOwner } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ guestToken: string }> };

/** GET /api/booking/[guestToken]/messages
 *  Returns all messages for the booking (oldest first).
 *  Marks owner's messages as read (guest is opening the thread). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) {
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  }

  await markMessagesRead(booking.id, "owner");
  const messages = await getMessagesForBooking(booking.id);
  return NextResponse.json({ messages });
}

/** POST /api/booking/[guestToken]/messages
 *  Body: { body: string }
 *  Inserts a guest message, then notifies the owner by email. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
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

  const message = await createMessage(booking.id, "guest", json.body as string);

  // Notify owner — non-critical
  try {
    const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
    if (shelter) {
      await sendNewMessageToOwner({
        ownerEmail: shelter.owner_email,
            notifyEmails: shelter.notify_emails,
        shelterTitle: shelter.title,
        ownerToken: shelter.owner_token,
        guestName: booking.guest_name,
        messageBody: json.body as string,
        bookingId: booking.id,
        shelterId: shelter.id,
      });
    }
  } catch (err) {
    console.error("guest message: owner email error:", err);
  }

  return NextResponse.json({ message }, { status: 201 });
}
