import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { getPaymentBySessionId, markPaymentExpired, markPaymentPaid } from "@/lib/payment-db";
import { sendBookingExpired, sendPaymentConfirmed } from "@/lib/booking-email";
import { cancelPendingBooking, updateBookingStatus } from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendGa4Event } from "@/lib/server-analytics";

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
        .select("guest_email, guest_name, guest_token, check_in, check_out, bookable_shelters!inner(owner_email, owner_token, title, payment_mode)")
        .eq("id", payment.booking_id)
        .single();

      if (booking) {
        const shelter = (booking as any).bookable_shelters;
        await sendGa4Event({
          eventName: "payment_completed",
          identityKey: `payment:${payment.booking_id}`,
          eventParams: {
            booking_id: payment.booking_id,
            payment_mode: shelter.payment_mode,
            amount_total_dkk: payment.amount_total_dkk,
          },
        });

        let shouldSendConfirmation = true;
        if (shelter.payment_mode === "upfront") {
          // Auto-confirm: payment = confirmed, no owner approval needed.
          // If the booking is no longer pending, do not send a false guest confirmation.
          shouldSendConfirmation = await updateBookingStatus(payment.booking_id, "confirmed");
          if (!shouldSendConfirmation) {
            console.error("Webhook: payment completed but booking was no longer pending", payment.booking_id);
          }
        }
        if (shouldSendConfirmation) {
          await sendPaymentConfirmed({
            guestEmail: booking.guest_email,
            guestName: booking.guest_name,
            ownerEmail: shelter.owner_email,
            ownerToken: shelter.owner_token,
            shelterTitle: shelter.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountTotalDkk: payment.amount_total_dkk,
            guestToken: booking.guest_token,
          });
        }
      }
    } catch (err) {
      console.error("Webhook: confirmation email failed (non-fatal):", err);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as { id: string };

    const payment = await getPaymentBySessionId(session.id);
    if (!payment) return NextResponse.json({ ok: true });
    if (payment.status !== "pending") return NextResponse.json({ ok: true });

    await markPaymentExpired(payment.id);

    const cancelled = await cancelPendingBooking(payment.booking_id);
    if (!cancelled) return NextResponse.json({ ok: true });

    try {
      const { data: booking } = await createAdminClient()
        .from("shelter_bookings")
        .select("guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, title)")
        .eq("id", payment.booking_id)
        .single();

      if (booking) {
        const shelter = (booking as any).bookable_shelters;
        await sendBookingExpired({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          ownerEmail: shelter.owner_email,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
        });
      }
    } catch (err) {
      console.error("Webhook: expired-booking email failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ ok: true });
}
