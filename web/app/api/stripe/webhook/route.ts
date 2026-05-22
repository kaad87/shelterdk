import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import {
  getPaymentBySessionId,
  markPaymentExpired,
} from "@/lib/payment-db";
import { sendBookingExpired } from "@/lib/booking-email";
import {
  cancelBooking,
  cancelPendingBooking,
} from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendGa4Event } from "@/lib/server-analytics";
import { recordBookingMonitorError, recordBookingMonitorEvent } from "@/lib/booking-monitor";
import { reconcileCompletedCheckoutSession } from "@/lib/payment-reconcile";

export const dynamic = "force-dynamic";

// IMPORTANT: Do NOT parse body as JSON — Stripe needs the raw bytes for signature verification
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = constructWebhookEvent(body, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("Stripe webhook error:", msg);
    await recordBookingMonitorError({
      source: "api/stripe/webhook",
      eventType: "webhook_signature_failed",
      message: "Stripe webhook-signatur kunne ikke verificeres",
      severity: "critical",
      notify: true,
      error: err,
      metadata: { hasSignature: Boolean(sig) },
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string };

    const payment = await getPaymentBySessionId(session.id);
    if (!payment) {
      // Session not in our DB — log and acknowledge to prevent Stripe retry
      console.error("Webhook: no payment row for session", session.id);
      await recordBookingMonitorEvent({
        severity: "error",
        source: "api/stripe/webhook",
        eventType: "payment_row_missing",
        message: "Webhook modtog completed session uden payment-række",
        notify: true,
        metadata: { sessionId: session.id },
      });
      return NextResponse.json({ ok: true });
    }

    // Idempotent: already processed
    if (payment.paid_at) return NextResponse.json({ ok: true });

    try {
      const result = await reconcileCompletedCheckoutSession(session.id, "api/stripe/webhook");
      if (result.state === "confirmed") {
        const { data: booking } = await createAdminClient()
          .from("shelter_bookings")
          .select("bookable_shelters!inner(payment_mode)")
          .eq("id", payment.booking_id)
          .single();
        const paymentMode =
          ((booking as any)?.bookable_shelters?.payment_mode as "after_confirmation" | "upfront" | undefined) ??
          undefined;
        try {
          // Custom event (for legacy dashboards)
          await sendGa4Event({
            eventName: "payment_completed",
            identityKey: `payment:${payment.booking_id}`,
            eventParams: {
              booking_id: payment.booking_id,
              payment_mode: paymentMode,
              amount_total_dkk: payment.amount_total_dkk,
            },
          });
          // GA4 standard e-commerce `purchase` event — unlocks built-in revenue,
          // AOV and conversion reporting.
          await sendGa4Event({
            eventName: "purchase",
            identityKey: `payment:${payment.booking_id}`,
            eventParams: {
              transaction_id: payment.booking_id,
              currency: "DKK",
              value: payment.amount_total_dkk,
              payment_mode: paymentMode,
            },
          });
        } catch (err) {
          console.error("Webhook: payment_completed analytics failed (non-fatal):", err);
        }
      }
    } catch (err) {
      console.error("Webhook: confirmation/payment processing failed:", err);
      await recordBookingMonitorError({
        source: "api/stripe/webhook",
        eventType: "confirmation_processing_failed",
        message: "Webhook kunne ikke færdigbehandle betaling/bekræftelse",
        paymentId: payment.id,
        bookingId: payment.booking_id,
        notify: true,
        error: err,
      });
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as { id: string };

    const payment = await getPaymentBySessionId(session.id);
    if (!payment) return NextResponse.json({ ok: true });
    if (payment.status !== "pending") return NextResponse.json({ ok: true });

    let cancelled = false;
    try {
      const { data: booking } = await createAdminClient()
        .from("shelter_bookings")
        .select("status, guest_email, guest_name, guest_count, check_in, check_out, bookable_shelters!inner(id, owner_email, title, payment_mode)")
        .eq("id", payment.booking_id)
        .single();

      const bookingStatus = booking?.status ?? null;
      const shelter = booking ? (booking as any).bookable_shelters : null;
      const paymentMode = shelter?.payment_mode as "after_confirmation" | "upfront" | undefined;

      if (bookingStatus === "pending") {
        cancelled = await cancelPendingBooking(payment.booking_id, "system");
      } else if (bookingStatus === "confirmed" && paymentMode === "after_confirmation") {
        cancelled = await cancelBooking(payment.booking_id, "system");
      }

      await markPaymentExpired(payment.id);

      if (cancelled && booking && shelter) {
        try {
          await sendBookingExpired({
            guestEmail: booking.guest_email,
            guestName: booking.guest_name,
            ownerEmail: shelter.owner_email,
            shelterTitle: shelter.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            bookingId: payment.booking_id,
            shelterId: shelter.id,
            paymentId: payment.id,
          });
        } catch (err) {
          console.error("Webhook: expired-booking email failed (non-fatal):", err);
        }
      }
    } catch (err) {
      console.error("Webhook: failed to expire pending booking after checkout.session.expired:", err);
      await recordBookingMonitorError({
        source: "api/stripe/webhook",
        eventType: "expire_processing_failed",
        message: "Webhook kunne ikke håndtere checkout.session.expired",
        paymentId: payment.id,
        bookingId: payment.booking_id,
        notify: true,
        error: err,
      });
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }
    if (!cancelled) return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
