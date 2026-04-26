import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { getPaymentBySessionId, markPaymentPaid } from "@/lib/payment-db";
import { sendPaymentConfirmed, sendUpfrontPaymentReceived } from "@/lib/booking-email";
import { createAdminClient } from "@/utils/supabase/server-admin";

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
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string };

    const payment = await getPaymentBySessionId(session.id);
    if (!payment) {
      // Session not in our DB — log and acknowledge to prevent Stripe retry
      console.error("Webhook: no payment row for session", session.id);
      return NextResponse.json({ ok: true });
    }

    // Idempotent: already processed
    if (payment.paid_at) return NextResponse.json({ ok: true });

    await markPaymentPaid(payment.id);

    // Send confirmation emails (non-critical — don't fail the webhook)
    try {
      const { data: booking } = await createAdminClient()
        .from("shelter_bookings")
        .select("guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, owner_token, title, payment_mode)")
        .eq("id", payment.booking_id)
        .single();

      if (booking) {
        const shelter = (booking as any).bookable_shelters;
        if (shelter.payment_mode === "upfront") {
          // Booking is still pending owner confirmation — notify owner
          await sendUpfrontPaymentReceived({
            ownerEmail: shelter.owner_email,
            shelterTitle: shelter.title,
            ownerToken: shelter.owner_token,
            guestName: booking.guest_name,
            guestEmail: booking.guest_email,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountTotalDkk: payment.amount_total_dkk,
          });
        } else {
          // after_confirmation: payment means booking is fully confirmed
          await sendPaymentConfirmed({
            guestEmail: booking.guest_email,
            guestName: booking.guest_name,
            ownerEmail: shelter.owner_email,
            shelterTitle: shelter.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountTotalDkk: payment.amount_total_dkk,
          });
        }
      }
    } catch (err) {
      console.error("Webhook: confirmation email failed (non-fatal):", err);
    }
  }

  // checkout.session.expired is intentionally unhandled — nightly cron is authoritative.
  // Known gap: between Stripe session expiry and the 02:00 UTC cron run, a booking
  // may stay 'confirmed' with a 'pending' payment for up to ~24h. The /betal page
  // detects this via expires_at and shows a "contact us" message. Acceptable for MVP.

  return NextResponse.json({ ok: true });
}
