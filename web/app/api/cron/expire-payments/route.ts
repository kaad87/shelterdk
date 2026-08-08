import { NextRequest, NextResponse } from "next/server";
import { listExpiredPendingPayments, markPaymentExpired } from "@/lib/payment-db";
import { sendBookingExpired } from "@/lib/booking-email";
import { cancelBooking, cancelPendingBooking } from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { recordBookingMonitorError, recordBookingMonitorEvent } from "@/lib/booking-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expiredPayments = await listExpiredPendingPayments();

  let cancelled = 0;
  let skipped = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    expiredPayments.map(async ({ id: paymentId, booking_id: bookingId }) => {
      const { data: booking } = await createAdminClient()
        .from("shelter_bookings")
        .select("status, guest_email, guest_name, check_in, check_out, bookable_shelters!inner(id, owner_email, notify_emails, title, payment_mode)")
        .eq("id", bookingId)
        .single();

      let wasCancelled = false;
      if (booking?.status === "pending") {
        wasCancelled = await cancelPendingBooking(bookingId, "system");
      } else if (booking?.status === "confirmed") {
        const shelter = (booking as any).bookable_shelters;
        if (shelter?.payment_mode === "after_confirmation") {
          wasCancelled = await cancelBooking(bookingId, "system");
        }
      }

      await markPaymentExpired(paymentId);
      if (!wasCancelled) {
        skipped += 1;
        return;
      }

      if (booking) {
        const shelter = (booking as any).bookable_shelters;
        await sendBookingExpired({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          ownerEmail: shelter.owner_email,
            notifyEmails: shelter.notify_emails,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          bookingId,
          shelterId: shelter.id,
          paymentId,
        });
      }

      cancelled++;
    })
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const bookingId = expiredPayments[index]?.booking_id;
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`expire-payments: failed for booking ${bookingId}:`, msg);
      errors.push(`${bookingId}: ${msg}`);
    }
  });

  if (errors.length > 0) {
    await recordBookingMonitorEvent({
      severity: "error",
      source: "api/cron/expire-payments",
      eventType: "cron_expire_payments_failed",
      message: `Expire-payments cron havde ${errors.length} fejl`,
      notify: true,
      metadata: { errors, cancelled, skipped },
    });
  } else if (cancelled > 0) {
    await recordBookingMonitorEvent({
      severity: "info",
      source: "api/cron/expire-payments",
      eventType: "payments_expired",
      message: `${cancelled} betaling(er) blev udløbet af cron`,
      metadata: { cancelled, skipped },
      needsAttention: false,
    });
  }

  return NextResponse.json({ ok: true, cancelled, skipped, errors });
}
