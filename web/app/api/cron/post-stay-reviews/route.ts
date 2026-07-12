import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendReviewRequestToGuest } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

/**
 * Dagligt cron: send "hvordan var dit ophold?"-mail til gæster dagen efter
 * check-out (op til 3 dages grace, så en fejlet kørsel samles op). Kun
 * bekræftede gæste-bookinger, én mail pr. booking (review_request_sent_at).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const graceStart = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);

  const { data: bookings, error } = await admin
    .from("shelter_bookings")
    .select(
      "id, guest_name, guest_email, guest_token, check_out, bookable_shelter_id, bookable_shelters!inner(title, shelter_id)"
    )
    .eq("status", "confirmed")
    .eq("source", "guest")
    .is("review_request_sent_at", null)
    .lte("check_out", today)
    .gte("check_out", graceStart)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];
  for (const b of bookings ?? []) {
    const unit = (b as { bookable_shelters?: { title?: string; shelter_id?: string | null } })
      .bookable_shelters;
    try {
      await sendReviewRequestToGuest({
        guestEmail: b.guest_email,
        guestName: b.guest_name,
        shelterTitle: unit?.title ?? "dit shelter",
        guestToken: b.guest_token,
        bookingId: b.id,
        shelterId: b.bookable_shelter_id,
      });
      await admin
        .from("shelter_bookings")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (err) {
      failures.push(`${b.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, candidates: (bookings ?? []).length, sent, failures });
}
