import { NextRequest, NextResponse } from "next/server";
import {
  getBookingByGuestToken,
  cancelBooking,
  getBookableShelterByPk,
  isRefundEligible,
} from "@/lib/booking-db";
import { getPaymentByBookingId } from "@/lib/payment-db";
import {
  sendGuestCancelledToGuest,
  sendGuestCancelledToOwner,
} from "@/lib/booking-email";
import { sendGa4Event } from "@/lib/server-analytics";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ guestToken: string }> }
) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) {
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Booking kan ikke annulleres i nuværende status" },
      { status: 409 }
    );
  }

  const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  // Race-condition safe: only cancels if still confirmed
  const cancelled = await cancelBooking(booking.id, "guest");
  if (!cancelled) {
    return NextResponse.json(
      { error: "Booking kan ikke annulleres i nuværende status" },
      { status: 409 }
    );
  }

  // Determine refund eligibility + issue Stripe refund if applicable
  const refundEligible = isRefundEligible(
    booking.check_in,
    shelter.cancellation_cutoff_hours
  );
  const payment = await getPaymentByBookingId(booking.id);
  let refunded = false;

  if (refundEligible && payment?.status === "paid") {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id,
        { expand: ["payment_intent"] }
      );
      const pi = session.payment_intent as { id?: string };
      if (pi?.id) {
        await stripe.refunds.create({ payment_intent: pi.id });
        refunded = true;
      }
    } catch (err) {
      console.error("guest cancel: Stripe refund error:", err);
      // Non-fatal — admin can issue manually
    }
  }

  // Send emails (non-critical)
  const amountTotalDkk = payment?.amount_total_dkk ?? null;
  try {
    await sendGuestCancelledToGuest({
      guestEmail: booking.guest_email,
      guestName: booking.guest_name,
      shelterTitle: shelter.title,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      refundEligible,
      amountTotalDkk: payment?.status === "paid" ? amountTotalDkk : null,
    });
  } catch (err) {
    console.error("guest cancel: guest email error:", err);
  }

  try {
    await sendGuestCancelledToOwner({
      ownerEmail: shelter.owner_email,
      ownerToken: shelter.owner_token,
      guestName: booking.guest_name,
      shelterTitle: shelter.title,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
    });
  } catch (err) {
    console.error("guest cancel: owner email error:", err);
  }

  await sendGa4Event({
    headers: _req.headers,
    eventName: "booking_cancelled",
    referrer: _req.headers.get("referer") ?? undefined,
    eventParams: {
      booking_id: booking.id,
      shelter_id: shelter.id,
      payment_mode: shelter.payment_mode,
      cancelled_by: "guest",
      refunded,
    },
  });

  return NextResponse.json({ ok: true, refunded });
}
