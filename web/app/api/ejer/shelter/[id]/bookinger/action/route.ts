import { NextRequest, NextResponse } from "next/server";
import {
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
  cancelBooking,
  BookingConflictError,
} from "@/lib/booking-db";
import {
  sendBookingRejectedToGuest,
  sendBookingConfirmedToGuest,
  sendPaymentRequestToGuest,
  sendRefundedToGuest,
  sendBookingAutoMessage,
  sendOwnerCancelledToGuest,
} from "@/lib/booking-email";
import { createCheckoutSession, calculateBookingAmounts } from "@/lib/stripe";
import {
  createBookingPayment,
  getPaymentByBookingId,
  markPaymentExpiredBySessionId,
} from "@/lib/payment-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendGa4Event } from "@/lib/server-analytics";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const shelter = context.shelter;
  const body = await req.json().catch(() => ({}));
  const bookingId: string = body.booking_id ?? "";
  const action: string = body.action ?? "";

  if (!bookingId || !["confirm", "reject", "resend-payment", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Ugyldige parametre" }, { status: 400 });
  }

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  if (action === "confirm") {
    if (booking.status !== "pending") {
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
    }

    const conflict = await hasConfirmedOverlap(
      shelter.id,
      booking.check_in,
      booking.check_out,
      bookingId
    );
    if (conflict) {
      return NextResponse.json(
        { error: "En anden bekræftet booking overlapper disse datoer" },
        { status: 409 }
      );
    }

    if (shelter.payment_mode === "upfront") {
      const updated = await updateBookingStatus(bookingId, "confirmed");
      if (!updated) {
        return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
      }
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
        console.error("ejer confirm (upfront): confirmation email error:", err);
      }
      const confirmationEmailSent = await sendAutoMessageIfEnabled(
        shelter.id,
        booking,
        shelter.title
      );
      try {
        await sendGa4Event({
          headers: req.headers,
          eventName: "booking_confirmed",
          referrer: req.headers.get("referer") ?? undefined,
          eventParams: {
            booking_id: bookingId,
            shelter_id: shelter.id,
            payment_mode: shelter.payment_mode,
            confirmation_channel: "owner_portal",
          },
        });
      } catch (err) {
        console.error("ejer confirm (upfront): non-fatal analytics error:", err);
      }
      return NextResponse.json({ ok: true, confirmationEmailSent });
    }

      try {
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        const { shelterDkk, platformDkk, totalDkk } = calculateBookingAmounts({
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          shelterPriceDkk: shelter.shelter_price_dkk,
          feePct: shelter.platform_fee_pct,
          feeMinDkk: shelter.platform_fee_min_dkk,
        });
        await createBookingPayment({
          bookingId,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        const updated = await updateBookingStatus(bookingId, "confirmed");
        if (!updated) {
          await markPaymentExpiredBySessionId(sessionId);
          return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
        }
        let warning: string | null = null;
        try {
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
          console.error("ejer confirm: payment email error:", err);
          warning =
            "Betalingslinket blev oprettet, men e-mailen kunne ikke sendes automatisk. Brug 'Gensend betalingslink'.";
        }
        try {
          await sendGa4Event({
            headers: req.headers,
            eventName: "payment_started",
            referrer: req.headers.get("referer") ?? undefined,
            eventParams: {
              booking_id: bookingId,
              shelter_id: shelter.id,
              payment_mode: shelter.payment_mode,
              amount_total_dkk: totalDkk,
              payment_context: "owner_confirm",
            },
          });
        } catch (err) {
          console.error("ejer confirm: non-fatal analytics error:", err);
        }

        const confirmationEmailSent = await sendAutoMessageIfEnabled(
          shelter.id,
          booking,
          shelter.title
        );
        try {
          await sendGa4Event({
            headers: req.headers,
            eventName: "booking_confirmed",
            referrer: req.headers.get("referer") ?? undefined,
            eventParams: {
              booking_id: bookingId,
              shelter_id: shelter.id,
              payment_mode: shelter.payment_mode,
              confirmation_channel: "owner_portal",
            },
          });
        } catch (err) {
          console.error("ejer confirm: non-fatal confirmation analytics error:", err);
        }
        return NextResponse.json({ ok: true, confirmationEmailSent, warning });
      } catch (err) {
        if (err instanceof BookingConflictError) {
          return NextResponse.json(
            { error: "En anden aktiv booking overlapper disse datoer" },
            { status: 409 }
          );
        }
        console.error("ejer confirm: payment setup error:", err);
        return NextResponse.json(
          { error: "Kunne ikke oprette betalingslink — prøv igen om et øjeblik" },
        { status: 500 }
      );
    }
  }

  if (action === "reject") {
    if (booking.status !== "pending") {
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
    }

    const updated = await updateBookingStatus(bookingId, "rejected");
    if (!updated) {
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
    }

    const payment = await getPaymentByBookingId(bookingId);
    let refunded = false;
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
          refunded = true;
        }
      } catch (err) {
        console.error("ejer reject: Stripe refund error:", err);
      }
    }

    if (refunded && payment) {
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
        console.error("ejer reject: refund email error:", err);
      }
    } else {
      try {
        await sendBookingRejectedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
        });
      } catch (err) {
        console.error("ejer reject email error:", err);
      }
    }

    try {
      await sendGa4Event({
        headers: req.headers,
        eventName: "booking_rejected",
        referrer: req.headers.get("referer") ?? undefined,
        eventParams: {
          booking_id: bookingId,
          shelter_id: shelter.id,
          payment_mode: shelter.payment_mode,
          refunded,
        },
      });
    } catch (err) {
      console.error("ejer reject: non-fatal analytics error:", err);
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "resend-payment") {
    if (booking.source === "owner_manual") {
      return NextResponse.json({ error: "Manuelle bookinger har ingen betalingslink" }, { status: 409 });
    }
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });
    }

    const existing = await getPaymentByBookingId(bookingId);
    if (existing?.status === "paid") {
      return NextResponse.json({ error: "Betaling allerede gennemført" }, { status: 409 });
    }

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
          await sendGa4Event({
            headers: req.headers,
            eventName: "payment_started",
            referrer: req.headers.get("referer") ?? undefined,
            eventParams: {
              booking_id: bookingId,
              shelter_id: shelter.id,
              payment_mode: shelter.payment_mode,
              amount_total_dkk: existing.amount_total_dkk,
              payment_context: "owner_resend",
            },
          });
          return NextResponse.json({ ok: true });
        }
      } catch (err) {
        console.error("ejer resend-payment: error reusing existing session:", err);
      }
    }

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const { shelterDkk, platformDkk, totalDkk } = calculateBookingAmounts({
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        shelterPriceDkk: shelter.shelter_price_dkk,
        feePct: shelter.platform_fee_pct,
        feeMinDkk: shelter.platform_fee_min_dkk,
      });
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
      await sendGa4Event({
        headers: req.headers,
        eventName: "payment_started",
        referrer: req.headers.get("referer") ?? undefined,
        eventParams: {
          booking_id: bookingId,
          shelter_id: shelter.id,
          payment_mode: shelter.payment_mode,
          amount_total_dkk: totalDkk,
          payment_context: "owner_resend",
        },
      });
    } catch (err) {
      console.error("ejer resend-payment error:", err);
      return NextResponse.json({ error: "Kunne ikke sende betalingslink" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Kun bekræftede bookinger kan annulleres" }, { status: 409 });
    }

    const cancelled = await cancelBooking(bookingId, "owner");
    if (!cancelled) {
      return NextResponse.json(
        { error: "Booking er allerede annulleret eller ikke bekræftet" },
        { status: 409 }
      );
    }

    const payment = await getPaymentByBookingId(bookingId);
    let refunded = false;
    let refundStatus: "refunded" | "manual_follow_up" | "not_refunded" = "not_refunded";
    if (booking.source !== "owner_manual" && payment?.status === "paid") {
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
        }
      } catch (err) {
        console.error("ejer cancel: Stripe refund error:", err);
        refundStatus = "manual_follow_up";
      }
    }

    if (booking.source !== "owner_manual") {
      try {
        await sendOwnerCancelledToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          refundStatus,
          amountTotalDkk: payment?.status === "paid" ? payment.amount_total_dkk : null,
        });
      } catch (err) {
        console.error("ejer cancel: guest email error:", err);
      }
    }

    try {
      await sendGa4Event({
        headers: req.headers,
        eventName: "booking_cancelled",
        referrer: req.headers.get("referer") ?? undefined,
        eventParams: {
          booking_id: bookingId,
          shelter_id: shelter.id,
          payment_mode: shelter.payment_mode,
          cancelled_by: "owner",
          refunded,
        },
      });
    } catch (err) {
      console.error("ejer cancel: non-fatal analytics error:", err);
    }

    return NextResponse.json({ ok: true, refunded });
  }

  return NextResponse.json({ error: "Ugyldig handling" }, { status: 400 });
}
