import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import {
  sendBookingRejectedToGuest,
  sendBookingConfirmedToGuest,
  sendPaymentRequestToGuest,
  sendRefundedToGuest,
  sendBookingAutoMessage,
} from "@/lib/booking-email";
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment, getPaymentByBookingId } from "@/lib/payment-db";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function calcNights(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

/**
 * Look up the owner's message template for this shelter and send the
 * confirmation auto-message if it is enabled.
 * Returns true if sent, false if skipped. Never throws — email errors are logged.
 */
async function sendAutoMessageIfEnabled(
  bookableShelterDbId: string,
  booking: { guest_email: string; guest_name: string; check_in: string; check_out: string; guest_count: number },
  shelterTitle: string
): Promise<boolean> {
  try {
    const { data: template } = await createAdminClient()
      .from("booking_message_templates")
      .select("confirmation_enabled,confirmation_subject,confirmation_body")
      .eq("shelter_id", bookableShelterDbId)
      .single();

    if (!template?.confirmation_enabled) return false;
    if (!template.confirmation_subject?.trim() || !template.confirmation_body?.trim()) return false;

    await sendBookingAutoMessage({
      guestEmail: booking.guest_email,
      subject: template.confirmation_subject,
      body: template.confirmation_body,
      ctx: {
        guestName: booking.guest_name,
        shelterTitle,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestCount: booking.guest_count,
      },
    });

    return true;
  } catch (err) {
    console.error("sendAutoMessageIfEnabled error:", err);
    return false;
  }
}

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

    if (shelter.payment_mode === "upfront") {
      // Payment already captured — confirm first, then send confirmation email
      await updateBookingStatus(bookingId, "confirmed");
      try {
        await sendBookingConfirmedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          guestToken: booking.guest_token,
        });
      } catch (err) {
        console.error("owner confirm (upfront): confirmation email error:", err);
      }
      const confirmationEmailSent = await sendAutoMessageIfEnabled(
        shelter.id, booking, shelter.title
      );
      return NextResponse.json({ ok: true, confirmationEmailSent });
    } else {
      // after_confirmation: create Stripe session FIRST — only confirm if that succeeds
      // This prevents the booking from being stuck as "confirmed" with no payment link
      try {
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        const nights = calcNights(booking.check_in, booking.check_out);
        const { shelterDkk, platformDkk, totalDkk } = calculateFee(
          (shelter.shelter_price_dkk ?? 0) * nights,
          shelter.platform_fee_pct,
          shelter.platform_fee_min_dkk
        );
        await updateBookingStatus(bookingId, "confirmed");
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
          guestToken: booking.guest_token,
        });
      } catch (err) {
        console.error("owner confirm: payment setup error:", err);
        return NextResponse.json(
          { error: "Kunne ikke oprette betalingslink — prøv igen om et øjeblik" },
          { status: 500 }
        );
      }
    }

    // after_confirmation: payment request sent — also send owner's auto-message
    const confirmationEmailSent = await sendAutoMessageIfEnabled(
      shelter.id, booking, shelter.title
    );
    return NextResponse.json({ ok: true, confirmationEmailSent });
  }

  // ── reject ───────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (booking.status !== "pending")
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

    await updateBookingStatus(bookingId, "rejected");

    // For upfront shelters with a paid payment: issue Stripe refund
    const payment = await getPaymentByBookingId(bookingId);
    if (shelter.payment_mode === "upfront" && payment?.status === "paid") {
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
        }
      } catch (err) {
        console.error("owner reject: Stripe refund error:", err);
        // Non-fatal — admin can issue refund manually in Stripe dashboard
      }
      try {
        await sendRefundedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          amountTotalDkk: payment.amount_total_dkk,
        });
      } catch (err) {
        console.error("owner reject: refund email error:", err);
      }
    } else {
      // Standard rejection email (no refund)
      try {
        await sendBookingRejectedToGuest({
          guestEmail: booking.guest_email, guestName: booking.guest_name,
          shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
        });
      } catch (err) {
        console.error("owner reject email error:", err);
      }
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

    // If a pending payment already exists, don't create a duplicate — just resend the existing link
    if (existing?.status === "pending" && existing.stripe_checkout_session_id) {
      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id);
        if (session.url && session.status === "open") {
          await sendPaymentRequestToGuest({
            guestEmail: booking.guest_email,
            guestName: booking.guest_name,
            shelterTitle: shelter.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountTotalDkk: existing.amount_total_dkk,
            amountShelterDkk: existing.amount_shelter_dkk,
            amountPlatformDkk: existing.amount_platform_dkk,
            paymentUrl: session.url,
            guestToken: booking.guest_token,
          });
          return NextResponse.json({ ok: true });
        }
        // Session expired — fall through to create a new one
      } catch (err) {
        console.error("resend-payment: error reusing existing session:", err);
        // Fall through to create new session
      }
    }

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const nights = calcNights(booking.check_in, booking.check_out);
      const { shelterDkk, platformDkk, totalDkk } = calculateFee(
        (shelter.shelter_price_dkk ?? 0) * nights,
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
        guestToken: booking.guest_token,
      });
    } catch (err) {
      console.error("resend-payment error:", err);
      return NextResponse.json({ error: "Kunne ikke sende betalingslink" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
}
