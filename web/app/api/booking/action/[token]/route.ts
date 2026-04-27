import { NextRequest, NextResponse } from "next/server";
import {
  resolveActionToken,
  markTokenUsed,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import {
  sendBookingConfirmedToGuest,
  sendBookingRejectedToGuest,
} from "@/lib/booking-email";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

export async function GET(
  _req: NextRequest,
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

  // Mark token used + update booking
  await markTokenUsed(tokenRow.id);
  const newStatus = tokenRow.action === "confirm" ? "confirmed" : "rejected";
  await updateBookingStatus(booking.id, newStatus);

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

  return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=${newStatus}`);
}
