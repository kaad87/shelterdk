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
import {
  createCheckoutSession,
  expireCheckoutSession,
  resolveBookingAmounts,
} from "@/lib/stripe";
import {
  createBookingPayment,
  expireSiblingPendingPayments,
  getLatestPendingPayment,
  getLatestPaidPayment,
  listPendingPaymentsByBookingId,
  listPaymentsByBookingId,
  markPaymentExpiredBySessionId,
} from "@/lib/payment-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendGa4Event } from "@/lib/server-analytics";
import { recordBookingMonitorError, recordBookingMonitorEvent } from "@/lib/booking-monitor";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

async function sendAutoMessageIfEnabled(
  bookableShelterDbId: string,
  booking: { id?: string; guest_email: string; guest_name: string; check_in: string; check_out: string; guest_count: number },
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
      bookingId: booking.id,
      shelterId: bookableShelterDbId,
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
      const paidPayment = getLatestPaidPayment(await listPaymentsByBookingId(bookingId));
      if (!paidPayment) {
        return NextResponse.json(
          { error: "Betalingen er ikke gennemført endnu" },
          { status: 409 }
        );
      }
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
          bookingId,
          shelterId: shelter.id,
        });
      } catch (err) {
        console.error("ejer confirm (upfront): confirmation email error:", err);
      }
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
      return NextResponse.json({ ok: true, confirmationEmailSent: false });
    }

      try {
        const stalePayments = await listPendingPaymentsByBookingId(bookingId);
        const { shelterDkk, platformDkk, totalDkk } = resolveBookingAmounts(booking, shelter);
        const { url, sessionId } = await createCheckoutSession(booking, shelter, {
          shelterDkk,
          platformDkk,
        });
        const created = await createBookingPayment({
          bookingId,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        await expireSiblingPendingPayments(bookingId, created.id).catch((err) => {
          console.error("ejer confirm: could not expire sibling pending payments:", err);
        });
        await Promise.all(
          stalePayments.map((payment) =>
            expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
              console.error("ejer confirm: could not expire sibling Stripe session:", err);
            })
          )
        );
        const updated = await updateBookingStatus(bookingId, "confirmed");
        if (!updated) {
          await markPaymentExpiredBySessionId(sessionId).catch((err) => {
            console.error("ejer confirm: could not expire payment row after 409:", err);
          });
          await expireCheckoutSession(sessionId).catch((err) => {
            console.error("ejer confirm: could not expire Stripe session after 409:", err);
          });
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
            bookingId,
            shelterId: shelter.id,
            paymentId: created.id,
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
        await recordBookingMonitorError({
          source: "api/ejer/shelter/[id]/bookinger/action",
          eventType: "owner_confirm_payment_setup_failed",
          message: "Ejer-confirm kunne ikke oprette betalingslink",
          bookingId,
          shelterId: shelter.id,
          notify: true,
          error: err,
        });
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

    const payment = getLatestPaidPayment(await listPaymentsByBookingId(bookingId));
    let refunded = false;
    let refundStatus: "refunded" | "manual_follow_up" | "not_refunded" = "not_refunded";
    let manualFollowUpReason: string | null = null;
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
          refundStatus = "refunded";
        } else {
          refundStatus = "manual_follow_up";
          manualFollowUpReason = "Stripe checkout-session manglede payment_intent.id";
        }
      } catch (err) {
        console.error("ejer reject: Stripe refund error:", err);
        refundStatus = "manual_follow_up";
        manualFollowUpReason = err instanceof Error ? err.message : String(err);
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
          bookingId,
          shelterId: shelter.id,
          paymentId: payment.id,
        });
      } catch (err) {
        console.error("ejer reject: refund email error:", err);
      }
    } else if (refundStatus === "manual_follow_up" && payment) {
      await recordBookingMonitorEvent({
        severity: "error",
        source: "api/ejer/shelter/[id]/bookinger/action",
        eventType: "owner_reject_refund_manual_follow_up",
        message: "Afvist booking kræver manuel refund-opfølgning",
        bookingId,
        shelterId: shelter.id,
        paymentId: payment.id,
        notify: true,
        metadata: { amountTotalDkk: payment.amount_total_dkk, reason: manualFollowUpReason },
      });
      try {
        await sendOwnerCancelledToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          refundStatus,
          amountTotalDkk: payment.amount_total_dkk,
          bookingId,
          shelterId: shelter.id,
          paymentId: payment.id,
        });
      } catch (err) {
        console.error("ejer reject: manual follow-up email error:", err);
      }
    } else {
      try {
        await sendBookingRejectedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          bookingId,
          shelterId: shelter.id,
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
    if (shelter.payment_mode !== "after_confirmation") {
      return NextResponse.json(
        { error: "Betalingslink kan kun gensendes for bookinger, der betales efter godkendelse" },
        { status: 409 }
      );
    }
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });
    }

    const payments = await listPaymentsByBookingId(bookingId);
    const paidPayment = getLatestPaidPayment(payments);
    const existing = getLatestPendingPayment(payments);
    const latestQuotedPayment = payments[0] ?? null;
    if (paidPayment) {
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
            bookingId,
            shelterId: shelter.id,
            paymentId: existing.id,
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
      const fallbackAmounts = resolveBookingAmounts(booking, shelter);
      const shelterDkk = latestQuotedPayment?.amount_shelter_dkk ?? fallbackAmounts.shelterDkk;
      const platformDkk = latestQuotedPayment?.amount_platform_dkk ?? fallbackAmounts.platformDkk;
      const totalDkk = latestQuotedPayment?.amount_total_dkk ?? fallbackAmounts.totalDkk;
      const { url, sessionId } = await createCheckoutSession(booking, shelter, {
        shelterDkk,
        platformDkk,
      });
      const stalePayments = await listPendingPaymentsByBookingId(bookingId);
      const created = await createBookingPayment({
        bookingId,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
      await expireSiblingPendingPayments(bookingId, created.id).catch((err) => {
        console.error("ejer resend-payment: could not expire sibling pending payments:", err);
      });
      await Promise.all(
        stalePayments.map((payment) =>
          expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
            console.error("ejer resend-payment: could not expire sibling Stripe session:", err);
          })
        )
      );
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
        bookingId,
        shelterId: shelter.id,
        paymentId: created.id,
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

    const stalePayments = await listPendingPaymentsByBookingId(bookingId);
    await expireSiblingPendingPayments(bookingId).catch((err) => {
      console.error("ejer cancel: could not expire pending payment rows:", err);
    });
    await Promise.all(
      stalePayments.map((payment) =>
        expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
          console.error("ejer cancel: could not expire Stripe session:", err);
        })
      )
    );

    const payment = getLatestPaidPayment(await listPaymentsByBookingId(bookingId));
    let refunded = false;
    let refundStatus: "refunded" | "manual_follow_up" | "not_refunded" = "not_refunded";
    let manualFollowUpReason: string | null = null;
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
        } else {
          refundStatus = "manual_follow_up";
          manualFollowUpReason = "Stripe checkout-session manglede payment_intent.id";
        }
      } catch (err) {
        console.error("ejer cancel: Stripe refund error:", err);
        refundStatus = "manual_follow_up";
        manualFollowUpReason = err instanceof Error ? err.message : String(err);
      }
    }

    if (refundStatus === "manual_follow_up" && payment) {
      await recordBookingMonitorEvent({
        severity: "error",
        source: "api/ejer/shelter/[id]/bookinger/action",
        eventType: "owner_cancel_refund_manual_follow_up",
        message: "Owner-annullering kræver manuel refund-opfølgning",
        bookingId,
        shelterId: shelter.id,
        paymentId: payment.id,
        notify: true,
        metadata: { amountTotalDkk: payment.amount_total_dkk, reason: manualFollowUpReason },
      });
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
          bookingId,
          shelterId: shelter.id,
          paymentId: payment?.id ?? undefined,
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
