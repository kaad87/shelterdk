import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
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
  calculateBookingAmounts,
  expireCheckoutSession,
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

export const dynamic = "force-dynamic";

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

  if (!bookingId || !["confirm", "reject", "resend-payment", "cancel"].includes(action))
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
        console.error("owner confirm (upfront): confirmation email error:", err);
      }
      const confirmationEmailSent = await sendAutoMessageIfEnabled(
        shelter.id, booking, shelter.title
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
            confirmation_channel: "owner_dashboard",
          },
        });
      } catch (err) {
        console.error("owner confirm (upfront): non-fatal analytics error:", err);
      }
      return NextResponse.json({ ok: true, confirmationEmailSent });
    } else {
      // after_confirmation: create Stripe session FIRST — only confirm if that succeeds
      // This prevents the booking from being stuck as "confirmed" with no payment link
      try {
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        const { shelterDkk, platformDkk, totalDkk } = calculateBookingAmounts({
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          shelterPriceDkk: shelter.shelter_price_dkk,
          feePct: shelter.platform_fee_pct,
          feeMinDkk: shelter.platform_fee_min_dkk,
        });
        const created = await createBookingPayment({
          bookingId,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        await expireSiblingPendingPayments(bookingId, created.id).catch((err) => {
          console.error("owner confirm: could not expire sibling pending payments:", err);
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
          console.error("owner confirm: payment email error:", err);
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
          console.error("owner confirm: non-fatal analytics error:", err);
        }
        const confirmationEmailSent = await sendAutoMessageIfEnabled(
          shelter.id, booking, shelter.title
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
              confirmation_channel: "owner_dashboard",
            },
          });
        } catch (err) {
          console.error("owner confirm: non-fatal confirmation analytics error:", err);
        }
        return NextResponse.json({ ok: true, confirmationEmailSent, warning });
      } catch (err) {
        if (err instanceof BookingConflictError) {
          return NextResponse.json(
            { error: "En anden aktiv booking overlapper disse datoer" },
            { status: 409 }
          );
        }
        console.error("owner confirm: payment setup error:", err);
        return NextResponse.json(
          { error: "Kunne ikke oprette betalingslink — prøv igen om et øjeblik" },
          { status: 500 }
        );
      }
    }
  }

  // ── reject ───────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (booking.status !== "pending")
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

    const updated = await updateBookingStatus(bookingId, "rejected");
    if (!updated) {
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });
    }

    // For upfront shelters with a paid payment: issue Stripe refund
    const payment = getLatestPaidPayment(await listPaymentsByBookingId(bookingId));
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
        console.error("owner reject: Stripe refund error:", err);
        // Non-fatal — admin can issue refund manually in Stripe dashboard
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
      console.error("owner reject: non-fatal analytics error:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // ── resend-payment ───────────────────────────────────────────────────────
  if (action === "resend-payment") {
    if (booking.source === "owner_manual")
      return NextResponse.json({ error: "Manuelle bookinger har ingen betalingslink" }, { status: 409 });
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

    const payments = await listPaymentsByBookingId(bookingId);
    const paidPayment = getLatestPaidPayment(payments);
    const existing = getLatestPendingPayment(payments);
    const latestQuotedPayment = payments[0] ?? null;
    if (paidPayment)
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
        // Session expired — fall through to create a new one
      } catch (err) {
        console.error("resend-payment: error reusing existing session:", err);
        // Fall through to create new session
      }
    }

    try {
      const fallbackAmounts = calculateBookingAmounts({
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        shelterPriceDkk: shelter.shelter_price_dkk,
        feePct: shelter.platform_fee_pct,
        feeMinDkk: shelter.platform_fee_min_dkk,
      });
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
        console.error("owner resend-payment: could not expire sibling pending payments:", err);
      });
      await Promise.all(
        stalePayments.map((payment) =>
          expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
            console.error("owner resend-payment: could not expire sibling Stripe session:", err);
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
      console.error("resend-payment error:", err);
      return NextResponse.json({ error: "Kunne ikke sende betalingslink" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── cancel ───────────────────────────────────────────────────────────────
  if (action === "cancel") {
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Kun bekræftede bookinger kan annulleres" }, { status: 409 });

    const cancelled = await cancelBooking(bookingId, "owner");
    if (!cancelled) {
      return NextResponse.json(
        { error: "Booking er allerede annulleret eller ikke bekræftet" },
        { status: 409 }
      );
    }

    const stalePayments = await listPendingPaymentsByBookingId(bookingId);
    await expireSiblingPendingPayments(bookingId).catch((err) => {
      console.error("owner cancel: could not expire pending payment rows:", err);
    });
    await Promise.all(
      stalePayments.map((payment) =>
        expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
          console.error("owner cancel: could not expire Stripe session:", err);
        })
      )
    );

    // Owner cancel → always full refund if payment exists
    const payment = getLatestPaidPayment(await listPaymentsByBookingId(bookingId));
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
        console.error("owner cancel: Stripe refund error:", err);
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
        console.error("owner cancel: guest email error:", err);
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
      console.error("owner cancel: non-fatal analytics error:", err);
    }

    return NextResponse.json({ ok: true, refunded });
  }

  return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
}
