import { NextRequest, NextResponse } from "next/server";
import {
  resolveActionToken,
  markTokenUsed,
  updateBookingStatus,
  hasConfirmedOverlap,
  BookingConflictError,
} from "@/lib/booking-db";
import {
  sendBookingConfirmedToGuest,
  sendBookingRejectedToGuest,
} from "@/lib/booking-email";
import { sendGa4Event } from "@/lib/server-analytics";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveActionToken(token);

  if (!result) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=not_found`);
  }

  const { token: tokenRow, booking, shelter } = result;

  // Already used
  if (tokenRow.used_at) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_used`);
  }

  // Expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=expired`);
  }

  // Booking already resolved
  if (booking.status !== "pending") {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
  }

  // Conflict check on confirm
  if (tokenRow.action === "confirm") {
    const conflict = await hasConfirmedOverlap(
      booking.bookable_shelter_id,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (conflict) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=conflict`);
    }
  }

  const newStatus = tokenRow.action === "confirm" ? "confirmed" : "rejected";
  try {
    const updated = await updateBookingStatus(booking.id, newStatus);
    if (!updated) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
    }
    await markTokenUsed(tokenRow.id);
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=conflict`);
    }
    throw err;
  }

  // Send email to guest
  try {
    if (newStatus === "confirmed") {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestToken: booking.guest_token,
      });
    } else {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
      });
    }
  } catch (err) {
    console.error("action email error:", err);
    // Don't fail the action if email fails
  }

  try {
    await sendGa4Event({
      headers: req.headers,
      eventName: newStatus === "confirmed" ? "booking_confirmed" : "booking_rejected",
      referrer: req.headers.get("referer") ?? undefined,
      eventParams: {
        booking_id: booking.id,
        shelter_id: shelter.id,
        payment_mode: shelter.payment_mode,
        confirmation_channel: "magic_link",
      },
    });
  } catch (err) {
    console.error("booking action: non-fatal analytics error:", err);
  }

  return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=${newStatus}`);
}
