import { NextRequest, NextResponse } from "next/server";
import { expireOldPayments } from "@/lib/payment-db";
import { sendBookingExpired } from "@/lib/booking-email";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expiredBookingIds = await expireOldPayments();

  let cancelled = 0;
  const errors: string[] = [];

  for (const bookingId of expiredBookingIds) {
    try {
      await createAdminClient()
        .from("shelter_bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);

      const { data: booking } = await createAdminClient()
        .from("shelter_bookings")
        .select("guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, title)")
        .eq("id", bookingId)
        .single();

      if (booking) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      cancelled++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`expire-payments: failed for booking ${bookingId}:`, msg);
      errors.push(`${bookingId}: ${msg}`);
    }
  }

  return NextResponse.json({ ok: true, cancelled, errors });
}
