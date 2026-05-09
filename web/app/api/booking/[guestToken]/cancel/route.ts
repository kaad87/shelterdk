import { NextRequest, NextResponse } from "next/server";
import {
  getBookingByGuestToken,
  cancelBooking,
  getBookableShelterByPk,
  isRefundEligible,
  cancelPendingBooking,
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

  if (!["pending", "confirmed"].includes(booking.status)) {
    return NextResponse.json(
      { error: "Booking kan ikke annulleres i nuværende status" },
      { status: 409 }
    );
  }

  const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  const wasPending = booking.status === "pending";
  // Race-condition safe: only cancels if booking is still in the expected state
  const cancelled = wasPending
    ? await cancelPendingBooking(booking.id)
    : await cancelBooking(booking.id, "guest");
  if (!cancelled) {
    return NextResponse.json(
      { error: "Booking kan ikke annulleres i nuværende status" },
      { status: 409 }
    );
  }

  // Determine refund eligibility + issue Stripe refund if applicable
  const refundEligible = !wasPending && isRefundEligible(
    booking.check_in,
    shelter.cancellation_cutoff_hours
  );
  const payment = await getPaymentByBookingId(booking.id);
  let refunded = false;
  let refundStatus: "refunded" | "manual_follow_up" | "not_refunded" = "not_refunded";
  let notice = wasPending
    ? "Din forespørgsel er trukket tilbage, og datoerne er frigivet."
    : "Din booking er annulleret.";

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
        refundStatus = "refunded";
        notice = "Din booking er annulleret, og refunderingen er sat i gang.";
      }
    } catch (err) {
      console.error("guest cancel: Stripe refund error:", err);
      // Non-fatal — admin can issue manually
      refundStatus = "manual_follow_up";
      notice = "Din booking er annulleret. Vi følger manuelt op på refunderingen hurtigst muligt.";
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
      refundStatus,
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

  try {
    await sendGa4Event({
      headers: _req.headers,
      eventName: "booking_cancelled",
      referrer: _req.headers.get("referer") ?? undefined,
      eventParams: {
        booking_id: booking.id,
        shelter_id: shelter.id,
        payment_mode: shelter.payment_mode,
        booking_status_before_cancel: booking.status,
        cancelled_by: "guest",
        refunded,
      },
    });
  } catch (err) {
    console.error("guest cancel: non-fatal analytics error:", err);
  }

  return NextResponse.json({ ok: true, refunded, wasPending, notice });
}
