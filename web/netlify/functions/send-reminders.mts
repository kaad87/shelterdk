import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { sendBookingAutoMessage } from "../../lib/booking-email";

// Note: This function authenticates with Supabase directly using the service role key.
// Netlify Scheduled Functions are called internally by Netlify's scheduler — no HTTP
// headers to verify. The service role key acts as the auth credential.

const handler: Handler = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Tomorrow in YYYY-MM-DD (UTC)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Fetch all confirmed bookings for tomorrow that haven't been sent a reminder yet
  const { data: bookings, error: fetchError } = await supabase
    .from("shelter_bookings")
    .select("id, guest_name, guest_email, guest_count, check_in, check_out, bookable_shelter_id")
    .eq("check_in", tomorrow)
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);

  if (fetchError) {
    console.error("send-reminders: fetch bookings error:", fetchError);
    return { statusCode: 500, body: "fetch error: " + fetchError.message };
  }

  const rows = bookings ?? [];
  console.log(`send-reminders: ${rows.length} booking(s) for ${tomorrow}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of rows) {
    try {
      // Get shelter title and template in parallel
      const [shelterResult, templateResult] = await Promise.all([
        supabase
          .from("bookable_shelters")
          .select("title")
          .eq("id", booking.bookable_shelter_id)
          .single(),
        supabase
          .from("booking_message_templates")
          .select("reminder_enabled, reminder_subject, reminder_body")
          .eq("shelter_id", booking.bookable_shelter_id)
          .single(),
      ]);

      // Skip if no template or reminder disabled
      if (!templateResult.data?.reminder_enabled) {
        skipped++;
        continue;
      }
      if (!templateResult.data.reminder_subject?.trim() || !templateResult.data.reminder_body?.trim()) {
        skipped++;
        continue;
      }
      if (!shelterResult.data) {
        console.warn(`send-reminders: shelter not found for booking ${booking.id}`);
        skipped++;
        continue;
      }

      await sendBookingAutoMessage({
        guestEmail: booking.guest_email,
        subject: templateResult.data.reminder_subject,
        body: templateResult.data.reminder_body,
        ctx: {
          guestName: booking.guest_name,
          shelterTitle: shelterResult.data.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          guestCount: booking.guest_count,
        },
      });

      // Mark as sent ONLY after successful send (idempotency guard)
      const { error: updateError } = await supabase
        .from("shelter_bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (updateError) {
        // Email was sent but DB update failed — log, don't count as failed
        console.error(`send-reminders: failed to mark sent for booking ${booking.id}:`, updateError);
      }

      sent++;
    } catch (err) {
      console.error(`send-reminders: error for booking ${booking.id}:`, err);
      failed++;
      // Continue with next booking — one failure doesn't stop the rest
    }
  }

  const summary = `send-reminders done: ${sent} sent, ${skipped} skipped, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

export default schedule("0 8 * * *", handler); // 08:00 UTC daily
