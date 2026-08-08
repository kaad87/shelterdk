import { createAdminClient } from "@/utils/supabase/server-admin";
import { cancelPendingBooking, updateBookingStatus } from "@/lib/booking-db";
import {
  expireSiblingPendingPayments,
  getPaymentBySessionId,
  markPaymentFailed,
  markPaymentPaid,
} from "@/lib/payment-db";
import {
  getCheckoutSession,
} from "@/lib/stripe";
import {
  sendBookingAutoMessage,
  sendPaymentConfirmed,
  sendRefundedToGuest,
} from "@/lib/booking-email";
import { recordBookingMonitorEvent } from "@/lib/booking-monitor";

async function sendAutoMessageIfEnabled(
  bookableShelterDbId: string,
  booking: { id?: string; guest_email: string; guest_name: string; check_in: string; check_out: string; guest_count?: number | null },
  shelterTitle: string
): Promise<void> {
  const { data: template } = await createAdminClient()
    .from("booking_message_templates")
    .select("confirmation_enabled,confirmation_subject,confirmation_body")
    .eq("shelter_id", bookableShelterDbId)
    .single();

  if (!template?.confirmation_enabled) return;
  if (!template.confirmation_subject?.trim() || !template.confirmation_body?.trim()) return;

  await sendBookingAutoMessage({
    guestEmail: booking.guest_email,
    subject: template.confirmation_subject,
    body: template.confirmation_body,
    ctx: {
      guestName: booking.guest_name,
      shelterTitle,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guestCount: booking.guest_count ?? 0,
    },
    bookingId: booking.id,
    shelterId: bookableShelterDbId,
  });
}

async function refundCheckoutSession(sessionId: string): Promise<"refunded" | "manual_follow_up"> {
  try {
    const session = await getCheckoutSession(sessionId);
    const pi = session.payment_intent as { id?: string } | null;
    if (!pi?.id) return "manual_follow_up";
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    await stripe.refunds.create({ payment_intent: pi.id });
    return "refunded";
  } catch (err) {
    console.error("payment reconcile: refund failed:", err);
    return "manual_follow_up";
  }
}

export interface CompletedCheckoutReconcileResult {
  state: "confirmed" | "awaiting" | "rejected" | "missing_payment";
  bookingId?: string;
  paymentId?: string;
  shelterId?: string;
}

export async function reconcileCompletedCheckoutSession(
  sessionId: string,
  source: string
): Promise<CompletedCheckoutReconcileResult> {
  const session = await getCheckoutSession(sessionId);
  if (session.status !== "complete") {
    return { state: "awaiting" };
  }

  const payment = await getPaymentBySessionId(sessionId);
  if (!payment) {
    await recordBookingMonitorEvent({
      severity: "critical",
      source,
      eventType: "payment_row_missing",
      message: "Completed Stripe-session mangler payment-række i ShelterDK",
      notify: true,
      metadata: { sessionId },
    });
    return { state: "missing_payment" };
  }

  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("id, status, guest_email, guest_name, guest_token, guest_count, check_in, check_out, bookable_shelters!inner(id, owner_email, notify_emails, owner_token, title, payment_mode)")
    .eq("id", payment.booking_id)
    .single();

  if (!booking) {
    await recordBookingMonitorEvent({
      severity: "critical",
      source,
      eventType: "booking_missing_for_payment",
      message: "Completed Stripe-session mangler tilhørende booking i ShelterDK",
      bookingId: payment.booking_id,
      paymentId: payment.id,
      notify: true,
      metadata: { sessionId },
    });
    return { state: "missing_payment", paymentId: payment.id, bookingId: payment.booking_id };
  }

  const shelter = (booking as any).bookable_shelters as {
    id: string;
    owner_email: string;
    notify_emails: string[] | null;
    owner_token: string;
    title: string;
    payment_mode: "after_confirmation" | "upfront";
  };

  const paymentWasPending = payment.status === "pending";
  const paymentAlreadyPaid = payment.status === "paid";
  let needsConfirmationEmails = false;

  if (!paymentWasPending && !paymentAlreadyPaid) {
    const refundStatus = await refundCheckoutSession(sessionId);
    await markPaymentFailed(payment.id).catch((err) => {
      console.error("payment reconcile: could not mark failed after stale session payment:", err);
    });
    try {
      await sendRefundedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: payment.amount_total_dkk,
        refundStatus,
        bookingId: payment.booking_id,
        shelterId: shelter.id,
        paymentId: payment.id,
      });
    } catch (err) {
      console.error("payment reconcile: stale-session refund notice failed:", err);
    }
    return {
      state: "rejected",
      bookingId: payment.booking_id,
      paymentId: payment.id,
      shelterId: shelter.id,
    };
  }

  if (shelter.payment_mode === "upfront") {
    if (booking.status === "pending") {
      const updated = await updateBookingStatus(payment.booking_id, "confirmed");
      if (!updated) {
        const refundStatus = await refundCheckoutSession(sessionId);
        await markPaymentFailed(payment.id).catch((err) => {
          console.error("payment reconcile: could not mark failed after upfront conflict:", err);
        });
        await cancelPendingBooking(payment.booking_id, "system").catch((err) => {
          console.error("payment reconcile: could not cancel stale upfront booking:", err);
        });
        try {
          await sendRefundedToGuest({
            guestEmail: booking.guest_email,
            guestName: booking.guest_name,
            shelterTitle: shelter.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountTotalDkk: payment.amount_total_dkk,
            refundStatus,
            bookingId: payment.booking_id,
            shelterId: shelter.id,
            paymentId: payment.id,
          });
        } catch (err) {
          console.error("payment reconcile: refund notice failed:", err);
        }
        return {
          state: "rejected",
          bookingId: payment.booking_id,
          paymentId: payment.id,
          shelterId: shelter.id,
        };
      }
      needsConfirmationEmails = true;
    } else if (booking.status !== "confirmed") {
      const refundStatus = await refundCheckoutSession(sessionId);
      await markPaymentFailed(payment.id).catch((err) => {
        console.error("payment reconcile: could not mark failed after invalid upfront state:", err);
      });
      try {
        await sendRefundedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          amountTotalDkk: payment.amount_total_dkk,
          refundStatus,
          bookingId: payment.booking_id,
          shelterId: shelter.id,
          paymentId: payment.id,
        });
      } catch (err) {
        console.error("payment reconcile: refund notice failed:", err);
      }
      return {
        state: "rejected",
        bookingId: payment.booking_id,
        paymentId: payment.id,
        shelterId: shelter.id,
      };
    } else if (paymentWasPending) {
      needsConfirmationEmails = true;
    }
  } else if (booking.status !== "confirmed") {
    const refundStatus = await refundCheckoutSession(sessionId);
    await markPaymentFailed(payment.id).catch((err) => {
      console.error("payment reconcile: could not mark failed after invalid after_confirmation state:", err);
    });
    await cancelPendingBooking(payment.booking_id, "system").catch((err) => {
      console.error("payment reconcile: could not cancel stale after_confirmation booking:", err);
    });
    try {
      await sendRefundedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: payment.amount_total_dkk,
        refundStatus,
        bookingId: payment.booking_id,
        shelterId: shelter.id,
        paymentId: payment.id,
      });
    } catch (err) {
      console.error("payment reconcile: refund notice failed:", err);
    }
    return {
      state: "rejected",
      bookingId: payment.booking_id,
      paymentId: payment.id,
      shelterId: shelter.id,
    };
  } else if (paymentWasPending) {
    needsConfirmationEmails = true;
  }

  if (paymentWasPending) {
    await markPaymentPaid(payment.id);
  }

  await expireSiblingPendingPayments(payment.booking_id, payment.id).catch((err) => {
    console.error("payment reconcile: failed to expire sibling payments:", err);
  });

  if (needsConfirmationEmails) {
    try {
      await sendPaymentConfirmed({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        ownerEmail: shelter.owner_email,
            notifyEmails: shelter.notify_emails,
        ownerToken: shelter.owner_token,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: payment.amount_total_dkk,
        guestToken: booking.guest_token,
        bookingId: payment.booking_id,
        shelterId: shelter.id,
        paymentId: payment.id,
      });
    } catch (err) {
      console.error("payment reconcile: confirmation email failed:", err);
    }
    try {
      await sendAutoMessageIfEnabled(shelter.id, booking, shelter.title);
    } catch (err) {
      console.error("payment reconcile: auto-message failed:", err);
    }
  }

  return {
    state: "confirmed",
    bookingId: payment.booking_id,
    paymentId: payment.id,
    shelterId: shelter.id,
  };
}
