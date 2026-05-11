import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookingPayment, OwnerPayout } from "@/types/booking";

/** Insert a new pending payment record */
export async function createBookingPayment(opts: {
  bookingId: string;
  stripeCheckoutSessionId: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
}): Promise<{ id: string }> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .insert({
      booking_id: opts.bookingId,
      stripe_checkout_session_id: opts.stripeCheckoutSessionId,
      amount_total_dkk: opts.amountTotalDkk,
      amount_shelter_dkk: opts.amountShelterDkk,
      amount_platform_dkk: opts.amountPlatformDkk,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error("createBookingPayment: " + error.message);
  return data;
}

export async function markPaymentLinkSent(paymentId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_payments")
    .update({ payment_link_sent_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) throw new Error("markPaymentLinkSent: " + error.message);
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

/** List all payments for a booking, newest first. */
export async function listPaymentsByBookingId(
  bookingId: string
): Promise<BookingPayment[]> {
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingPayment[];
}

/** List pending payments for a booking, newest first, optionally excluding one row. */
export async function listPendingPaymentsByBookingId(
  bookingId: string,
  exceptPaymentId?: string | null
): Promise<BookingPayment[]> {
  let query = createAdminClient()
    .from("booking_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (exceptPaymentId) {
    query = query.neq("id", exceptPaymentId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingPayment[];
}

/** Prefer a completed payment over any newer pending/expired rows. */
export function getLatestPaidPayment(payments: BookingPayment[]): BookingPayment | null {
  return payments.find((payment) => payment.status === "paid") ?? null;
}

/** Return the newest pending payment row. */
export function getLatestPendingPayment(payments: BookingPayment[]): BookingPayment | null {
  return payments.find((payment) => payment.status === "pending") ?? null;
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

/** Mark a payment as failed/refunded-recovery-needed without erasing paid_at history. */
export async function markPaymentFailed(paymentId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_payments")
    .update({ status: "failed" })
    .eq("id", paymentId)
    .neq("status", "paid");
  if (error) throw new Error("markPaymentFailed: " + error.message);
}

/** Mark a payment as expired if it is still pending. */
export async function markPaymentExpired(paymentId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_payments")
    .update({ status: "expired" })
    .eq("id", paymentId)
    .eq("status", "pending");
  if (error) throw new Error("markPaymentExpired: " + error.message);
}

/** Mark a payment as expired by Stripe session ID if it is still pending. */
export async function markPaymentExpiredBySessionId(sessionId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_payments")
    .update({ status: "expired" })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("status", "pending");
  if (error) throw new Error("markPaymentExpiredBySessionId: " + error.message);
}

/** Expire any other pending payment rows for the same booking. */
export async function expireSiblingPendingPayments(
  bookingId: string,
  exceptPaymentId?: string | null
): Promise<void> {
  let query = createAdminClient()
    .from("booking_payments")
    .update({ status: "expired" })
    .eq("booking_id", bookingId)
    .eq("status", "pending");

  if (exceptPaymentId) {
    query = query.neq("id", exceptPaymentId);
  }

  const { error } = await query;
  if (error) throw new Error("expireSiblingPendingPayments: " + error.message);
}

/**
 * List all pending payments past their expires_at.
 * Callers should cancel the linked booking first and only then mark the payment expired,
 * so transient cancellation failures remain retryable.
 */
export async function listExpiredPendingPayments(): Promise<
  Array<{ id: string; booking_id: string }>
> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("id, booking_id")
    .eq("status", "pending")
    .lt("expires_at", now)
    .limit(100);
  if (error) throw new Error("listExpiredPendingPayments: " + error.message);
  return (data ?? []) as Array<{ id: string; booking_id: string }>;
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
      shelter_bookings!inner (
        guest_name, check_in, check_out,
        bookable_shelters!inner ( title )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("getPaymentsForAdmin: " + error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    guest_name: row.shelter_bookings.guest_name,
    check_in: row.shelter_bookings.check_in,
    check_out: row.shelter_bookings.check_out,
    shelter_title: row.shelter_bookings.bookable_shelters.title,
    shelter_bookings: undefined,
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
  return (data ?? []).map((row: any) => ({
    ...row,
    shelter_title: row.bookable_shelters.title,
    bookable_shelters: undefined,
  }));
}
