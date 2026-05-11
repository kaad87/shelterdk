import { NextRequest, NextResponse } from "next/server";
import {
  resolveActionToken,
  markTokenUsed,
  updateBookingStatus,
  hasConfirmedOverlap,
  BookingConflictError,
} from "@/lib/booking-db";
import {
  sendBookingConfirmedToGuest,
  sendBookingAutoMessage,
  sendPaymentRequestToGuest,
  sendBookingRejectedToGuest,
} from "@/lib/booking-email";
import {
  createCheckoutSession,
  expireCheckoutSession,
  resolveBookingAmounts,
} from "@/lib/stripe";
import {
  createBookingPayment,
  expireSiblingPendingPayments,
  listPendingPaymentsByBookingId,
  markPaymentExpiredBySessionId,
} from "@/lib/payment-db";
import { sendGa4Event } from "@/lib/server-analytics";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { recordBookingMonitorError, recordBookingMonitorEvent } from "@/lib/booking-monitor";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

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
    console.error("magic confirm auto-message error:", err);
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveActionToken(token);

  if (!result) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=not_found`);
  }

  const { token: tokenRow, booking, shelter } = result;

  // Already used
  if (tokenRow.used_at) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_used`);
  }

  // Expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=expired`);
  }

  // Booking already resolved
  if (booking.status !== "pending") {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
  }

  // Conflict check on confirm
  if (tokenRow.action === "confirm") {
    const conflict = await hasConfirmedOverlap(
      booking.bookable_shelter_id,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (conflict) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=conflict`);
    }
  }

  const newStatus = tokenRow.action === "confirm" ? "confirmed" : "rejected";
  try {
    if (tokenRow.action === "confirm" && shelter.payment_mode === "after_confirmation") {
      const { shelterDkk, platformDkk, totalDkk } = resolveBookingAmounts(booking, shelter);
      const { url, sessionId } = await createCheckoutSession(booking, shelter, {
        shelterDkk,
        platformDkk,
      });
      const stalePayments = await listPendingPaymentsByBookingId(booking.id);
      const created = await createBookingPayment({
        bookingId: booking.id,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
      await expireSiblingPendingPayments(booking.id, created.id).catch((err) => {
        console.error("magic confirm: could not expire sibling pending payments:", err);
      });
      await Promise.all(
        stalePayments.map((payment) =>
          expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
            console.error("magic confirm: could not expire sibling Stripe session:", err);
          })
        )
      );

      const updated = await updateBookingStatus(booking.id, newStatus);
      if (!updated) {
        await markPaymentExpiredBySessionId(sessionId).catch((err) => {
          console.error("magic confirm: could not expire payment row after 409:", err);
        });
        await expireCheckoutSession(sessionId).catch((err) => {
          console.error("magic confirm: could not expire Stripe session after 409:", err);
        });
        return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
      }

      await markTokenUsed(tokenRow.id);
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
          bookingId: booking.id,
          shelterId: shelter.id,
          paymentId: created.id,
        });
      } catch (err) {
        console.error("magic confirm payment email error:", err);
      }
      await sendAutoMessageIfEnabled(booking.bookable_shelter_id, booking, shelter.title);
      try {
        await sendGa4Event({
          headers: req.headers,
          eventName: "payment_started",
          referrer: req.headers.get("referer") ?? undefined,
          eventParams: {
            booking_id: booking.id,
            shelter_id: shelter.id,
            payment_mode: shelter.payment_mode,
            amount_total_dkk: totalDkk,
            payment_context: "magic_confirm",
          },
        });
      } catch (err) {
        console.error("magic confirm payment analytics error:", err);
      }
      try {
        await sendGa4Event({
          headers: req.headers,
          eventName: "booking_confirmed",
          referrer: req.headers.get("referer") ?? undefined,
          eventParams: {
            booking_id: booking.id,
            shelter_id: shelter.id,
            payment_mode: shelter.payment_mode,
            confirmation_channel: "magic_link",
          },
        });
        } catch (err) {
          console.error("booking action: non-fatal analytics error:", err);
        }
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=confirmed_payment_required`);
    }

    const updated = await updateBookingStatus(booking.id, newStatus);
    if (!updated) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
    }
    await markTokenUsed(tokenRow.id);
  } catch (err) {
    if (err instanceof BookingConflictError) {
      await recordBookingMonitorEvent({
        severity: "warning",
        source: "api/booking/action/[token]",
        eventType: "magic_confirm_conflict",
        message: "Magic-link confirm tabte pga. bookingkonflikt",
        bookingId: booking.id,
        shelterId: shelter.id,
        metadata: { tokenId: tokenRow.id },
      });
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=conflict`);
    }
    await recordBookingMonitorError({
      source: "api/booking/action/[token]",
      eventType: "magic_action_failed",
      message: "Magic-link action kunne ikke gennemføres",
      bookingId: booking.id,
      shelterId: shelter.id,
      notify: true,
      error: err,
      metadata: { tokenId: tokenRow.id, action: tokenRow.action, paymentMode: shelter.payment_mode },
    });
    throw err;
  }

  // Send email to guest
  try {
    if (newStatus === "confirmed") {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestToken: booking.guest_token,
        bookingId: booking.id,
        shelterId: shelter.id,
      });
    } else {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        bookingId: booking.id,
        shelterId: shelter.id,
      });
    }
  } catch (err) {
    console.error("action email error:", err);
    // Don't fail the action if email fails
  }

  try {
    await sendGa4Event({
      headers: req.headers,
      eventName: newStatus === "confirmed" ? "booking_confirmed" : "booking_rejected",
      referrer: req.headers.get("referer") ?? undefined,
      eventParams: {
        booking_id: booking.id,
        shelter_id: shelter.id,
        payment_mode: shelter.payment_mode,
        confirmation_channel: "magic_link",
      },
    });
  } catch (err) {
    console.error("booking action: non-fatal analytics error:", err);
  }

  return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=${newStatus}`);
}
