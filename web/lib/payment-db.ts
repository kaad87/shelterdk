import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookingPayment, OwnerPayout } from "@/types/booking";

/** Insert a new pending payment record */
export async function createBookingPayment(opts: {
  bookingId: string;
  stripeCheckoutSessionId: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await createAdminClient()
    .from("booking_payments")
    .insert({
      booking_id: opts.bookingId,
      stripe_checkout_session_id: opts.stripeCheckoutSessionId,
      amount_total_dkk: opts.amountTotalDkk,
      amount_shelter_dkk: opts.amountShelterDkk,
      amount_platform_dkk: opts.amountPlatformDkk,
      payment_link_sent_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  if (error) throw new Error("createBookingPayment: " + error.message);
}

/** Look up payment by Stripe session ID — used in webhook handler */
export async function getPaymentBySessionId(
  sessionId: string
): Promise<BookingPayment | null> {
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data ?? null;
}

/** Look up most recent payment by booking ID */
export async function getPaymentByBookingId(
  bookingId: string
): Promise<BookingPayment | null> {
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Mark a payment as paid — idempotent (only updates if paid_at is null) */
export async function markPaymentPaid(paymentId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .is("paid_at", null);
  if (error) throw new Error("markPaymentPaid: " + error.message);
}

/**
 * Expire all pending payments past their expires_at.
 * Returns the booking IDs of expired payments so the caller can cancel those bookings.
 */
export async function expireOldPayments(): Promise<string[]> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", now)
    .select("booking_id");
  if (error) throw new Error("expireOldPayments: " + error.message);
  return (data ?? []).map((r: { booking_id: string }) => r.booking_id);
}

/** List all payments for admin UI, joined with booking + shelter data */
export async function getPaymentsForAdmin(): Promise<
  Array<
    BookingPayment & {
      shelter_title: string;
      guest_name: string;
      check_in: string;
      check_out: string;
    }
  >
> {
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select(`
      *,
      bookings!inner (
        guest_name, check_in, check_out,
        bookable_shelters!inner ( title )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("getPaymentsForAdmin: " + error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    guest_name: row.bookings.guest_name,
    check_in: row.bookings.check_in,
    check_out: row.bookings.check_out,
    shelter_title: row.bookings.bookable_shelters.title,
    bookings: undefined,
  }));
}

/** Create an owner payout record */
export async function createOwnerPayout(opts: {
  shelterId: string;
  periodStart: string;
  periodEnd: string;
  amountDkk: number;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("owner_payouts")
    .insert({
      shelter_id: opts.shelterId,
      period_start: opts.periodStart,
      period_end: opts.periodEnd,
      amount_dkk: opts.amountDkk,
    });
  if (error) throw new Error("createOwnerPayout: " + error.message);
}

/** Mark a payout as paid */
export async function markPayoutPaid(
  payoutId: string,
  notes: string | null
): Promise<void> {
  const { error } = await createAdminClient()
    .from("owner_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString(), notes })
    .eq("id", payoutId);
  if (error) throw new Error("markPayoutPaid: " + error.message);
}

/** List all payouts for admin UI */
export async function getPayoutsForAdmin(): Promise<
  Array<OwnerPayout & { shelter_title: string }>
> {
  const { data, error } = await createAdminClient()
    .from("owner_payouts")
    .select("*, bookable_shelters!inner(title)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("getPayoutsForAdmin: " + error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    shelter_title: row.bookable_shelters.title,
    bookable_shelters: undefined,
  }));
}
