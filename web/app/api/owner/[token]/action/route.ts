import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import {
  sendBookingRejectedToGuest,
  sendPaymentRequestToGuest,
} from "@/lib/booking-email";
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment, getPaymentByBookingId } from "@/lib/payment-db";

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

  if (!bookingId || !["confirm", "reject", "resend-payment"].includes(action))
    return NextResponse.json({ error: "Ugyldige parametre" }, { status: 400 });

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  // ── confirm ─────────────────────────────────────────────────────────────
  // Note: sendBookingConfirmedToGuest is intentionally replaced by
  // sendPaymentRequestToGuest. The confirmation email is sent later
  // by the Stripe webhook after payment completes.
  if (action === "confirm") {
    if (booking.status !== "pending")
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

    const conflict = await hasConfirmedOverlap(
      shelter.id, booking.check_in, booking.check_out, bookingId
    );
    if (conflict)
      return NextResponse.json(
        { error: "En anden bekræftet booking overlapper disse datoer" },
        { status: 409 }
      );

    await updateBookingStatus(bookingId, "confirmed");

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const { shelterDkk, platformDkk, totalDkk } = calculateFee(
        shelter.shelter_price_dkk ?? 0,
        shelter.platform_fee_pct,
        shelter.platform_fee_min_dkk
      );
      await createBookingPayment({
        bookingId,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
      await sendPaymentRequestToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
        paymentUrl: url,
      });
    } catch (err) {
      console.error("owner confirm: payment setup error:", err);
      // Booking is confirmed but no payment row — admin can resend via dashboard
    }

    return NextResponse.json({ ok: true });
  }

  // ── reject ───────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (booking.status !== "pending")
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

    await updateBookingStatus(bookingId, "rejected");

    try {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    } catch (err) {
      console.error("owner reject email error:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // ── resend-payment ───────────────────────────────────────────────────────
  if (action === "resend-payment") {
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

    const existing = await getPaymentByBookingId(bookingId);
    if (existing?.status === "paid")
      return NextResponse.json({ error: "Betaling allerede gennemført" }, { status: 409 });

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const { shelterDkk, platformDkk, totalDkk } = calculateFee(
        shelter.shelter_price_dkk ?? 0,
        shelter.platform_fee_pct,
        shelter.platform_fee_min_dkk
      );
      await createBookingPayment({
        bookingId,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
      await sendPaymentRequestToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
        paymentUrl: url,
      });
    } catch (err) {
      console.error("resend-payment error:", err);
      return NextResponse.json({ error: "Kunne ikke sende betalingslink" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
}
