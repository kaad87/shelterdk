import { NextRequest, NextResponse } from "next/server";
import { getBookingByIdForShelter } from "@/lib/booking-db";
import {
  createMessage,
  getMessagesForBooking,
  markMessagesRead,
  validateMessageBody,
} from "@/lib/messages-db";
import { sendNewMessageToGuest } from "@/lib/booking-email";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; bookingId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, bookingId } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const booking = await getBookingByIdForShelter(bookingId, context.shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  if (booking.source === "owner_manual") {
    return NextResponse.json(
      { error: "Manuelle bookinger bruger ikke beskedtråde i ShelterDK" },
      { status: 409 }
    );
  }

  await markMessagesRead(booking.id, "guest");
  const messages = await getMessagesForBooking(booking.id);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, bookingId } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const booking = await getBookingByIdForShelter(bookingId, context.shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  if (!["pending", "confirmed"].includes(booking.status)) {
    return NextResponse.json(
      { error: "Beskeder er ikke tilgængelige for denne booking" },
      { status: 409 }
    );
  }
  if (booking.source === "owner_manual") {
    return NextResponse.json(
      { error: "Manuelle bookinger bruger ikke beskedtråde i ShelterDK" },
      { status: 409 }
    );
  }

  const json = await req.json().catch(() => null);
  const validationError = validateMessageBody(json?.body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const message = await createMessage(booking.id, "owner", json.body as string);

  try {
    await sendNewMessageToGuest({
      guestEmail: booking.guest_email,
      guestName: booking.guest_name,
      shelterTitle: context.shelter.title,
      guestToken: booking.guest_token,
      messageBody: json.body as string,
    });
  } catch (err) {
    console.error("ejer owner message: guest email error:", err);
  }

  return NextResponse.json({ message }, { status: 201 });
}
