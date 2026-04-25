# Payment & MobilePay Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Stripe-based payment system with MobilePay support for ShelterDK bookings — transaction fees, webhook handling, guest payment pages, owner dashboard updates, and admin payout management.

**Architecture:** When an owner confirms a booking, a Stripe Checkout Session is created and a payment link is emailed to the guest. A Stripe webhook marks the payment paid and sends confirmation emails. A nightly Netlify Scheduled Function expires unpaid bookings after 24h. Admins manage owner payouts manually via a simple UI.

**Tech Stack:** `stripe` npm package, Next.js 14 App Router, Supabase, Resend (email), Netlify Scheduled Functions, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/<ts>_add_payments.sql` | Create | DB: new columns + booking_payments + owner_payouts |
| `web/types/booking.ts` | Modify | Add BookingPayment, OwnerPayout types; extend BookableShelter |
| `web/lib/__tests__/stripe.test.ts` | Create | Unit tests for calculateFee (written before implementation) |
| `web/lib/stripe.ts` | Create | calculateFee, createCheckoutSession, constructWebhookEvent |
| `web/lib/payment-db.ts` | Create | DB helpers: create/get/mark payment, expire old, payouts |
| `web/lib/booking-email.ts` | Modify | Add sendPaymentRequestToGuest, sendPaymentConfirmed, sendBookingExpired |
| `web/app/api/owner/[token]/action/route.ts` | Modify | Extend confirm to create Stripe session; add resend-payment action |
| `web/app/api/owner/[token]/payments/route.ts` | Create | GET payment info for owner's bookings |
| `web/app/api/owner/[token]/settings/route.ts` | Modify | Add shelter_price_dkk field handling |
| `web/app/api/stripe/webhook/route.ts` | Create | Handle checkout.session.completed |
| `web/app/api/cron/expire-payments/route.ts` | Create | Expire pending payments past their deadline |
| `web/netlify/functions/expire-payments-cron.ts` | Create | Netlify Scheduled Function calling the cron route (02:00 UTC) |
| `web/app/(site)/booking/[id]/betal/page.tsx` | Create | Guest payment page (shows breakdown + Stripe link) |
| `web/app/(site)/booking/[id]/tak/page.tsx` | Create | Guest success page (Stripe success_url) |
| `web/components/owner/OwnerDashboard.tsx` | Modify | Payment status badge, resend button, price-per-night field |
| `web/lib/admin-auth.ts` | Create (if missing) | Shared isAdmin helper for admin routes |
| `web/app/api/admin/payments/route.ts` | Create | List payments (admin, x-admin-secret) |
| `web/app/api/admin/payouts/route.ts` | Create | GET + POST payouts (admin) |
| `web/app/api/admin/payouts/[id]/route.ts` | Create | PATCH mark payout paid (admin) |
| `web/app/(site)/admin/payments/page.tsx` | Create | Admin UI: transactions + payouts tables |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_add_payments.sql`

- [ ] **Step 1: Get timestamp format from existing migrations**

```bash
ls /Users/CKA/shelterdk/supabase/migrations/ | tail -3
```

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/<YYYYMMDDHHMMSS>_add_payments.sql` (use current timestamp):

```sql
-- Pricing fields on bookable_shelters
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS shelter_price_dkk    integer       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_pct     decimal(5,2)  NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS platform_fee_min_dkk integer       NOT NULL DEFAULT 25;

-- Payment tracking per booking
CREATE TABLE IF NOT EXISTS booking_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_checkout_session_id  text NOT NULL UNIQUE,
  amount_total_dkk            integer NOT NULL,
  amount_shelter_dkk          integer NOT NULL,
  amount_platform_dkk         integer NOT NULL,
  status                      text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed','expired')),
  payment_link_sent_at        timestamptz,
  paid_at                     timestamptz,
  expires_at                  timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_payments_booking_id_idx
  ON booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS booking_payments_status_expires_idx
  ON booking_payments(status, expires_at);

-- Owner payout tracking
CREATE TABLE IF NOT EXISTS owner_payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  amount_dkk   integer NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Apply migration**

```bash
cd /Users/CKA/shelterdk && npx supabase db push
```

If Supabase CLI is not linked, apply via Supabase dashboard → SQL editor → paste and run.

Expected: No errors. Tables `booking_payments` and `owner_payouts` visible in dashboard.

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk
git add supabase/migrations/
git commit -m "feat: add booking_payments and owner_payouts tables"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `web/types/booking.ts`

- [ ] **Step 1: Read current file**

```bash
cat web/types/booking.ts
```

Note the existing `BookableShelter` interface — it currently ends after `created_at: string`.

- [ ] **Step 2: Add three new fields to BookableShelter**

In the `BookableShelter` interface, add before `created_at`:

```typescript
  shelter_price_dkk: number | null;
  platform_fee_pct: number;
  platform_fee_min_dkk: number;
```

- [ ] **Step 3: Append new types at end of file**

```typescript
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface BookingPayment {
  id: string;
  booking_id: string;
  stripe_checkout_session_id: string;
  amount_total_dkk: number;
  amount_shelter_dkk: number;
  amount_platform_dkk: number;
  status: PaymentStatus;
  payment_link_sent_at: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
}

export type PayoutStatus = "pending" | "paid";

export interface OwnerPayout {
  id: string;
  shelter_id: string;
  period_start: string;
  period_end: string;
  amount_dkk: number;
  status: PayoutStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add web/types/booking.ts
git commit -m "feat: add BookingPayment and OwnerPayout types; extend BookableShelter"
```

---

### Task 3: Stripe Library (TDD)

**Files:**
- Create: `web/lib/__tests__/stripe.test.ts`
- Create: `web/lib/stripe.ts`

- [ ] **Step 1: Install Stripe**

```bash
cd /Users/CKA/shelterdk/web && npm install stripe
```

Expected: `"stripe"` appears in `package.json` dependencies.

- [ ] **Step 2: Write failing test first**

Create `web/lib/__tests__/stripe.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateFee } from "@/lib/stripe";

describe("calculateFee", () => {
  it("free shelter: guest pays minimum fee only", () => {
    expect(calculateFee(0, 5, 25)).toEqual({
      shelterDkk: 0, platformDkk: 25, totalDkk: 25,
    });
  });

  it("cheap shelter: minimum beats percentage (100 kr × 5% = 5 < 25)", () => {
    expect(calculateFee(100, 5, 25)).toEqual({
      shelterDkk: 100, platformDkk: 25, totalDkk: 125,
    });
  });

  it("expensive shelter: percentage beats minimum (600 kr × 5% = 30 > 25)", () => {
    expect(calculateFee(600, 5, 25)).toEqual({
      shelterDkk: 600, platformDkk: 30, totalDkk: 630,
    });
  });

  it("exact crossover: percentage equals minimum (500 kr × 5% = 25)", () => {
    expect(calculateFee(500, 5, 25)).toEqual({
      shelterDkk: 500, platformDkk: 25, totalDkk: 525,
    });
  });

  it("rounds platform fee to whole DKK (333 kr × 5% = 16.65 → 17)", () => {
    expect(calculateFee(333, 5, 0)).toEqual({
      shelterDkk: 333, platformDkk: 17, totalDkk: 350,
    });
  });

  it("zero minimum: only percentage applies", () => {
    expect(calculateFee(200, 10, 0)).toEqual({
      shelterDkk: 200, platformDkk: 20, totalDkk: 220,
    });
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/stripe.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/stripe'"

- [ ] **Step 4: Implement stripe.ts**

Create `web/lib/stripe.ts`:

```typescript
import Stripe from "stripe";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/**
 * Calculate fee breakdown. All amounts are whole DKK.
 * Formula: platformDkk = max(round(priceDkk × feePct / 100), feeMinDkk)
 */
export function calculateFee(
  priceDkk: number,
  feePct: number,
  feeMinDkk: number
): { shelterDkk: number; platformDkk: number; totalDkk: number } {
  const shelterDkk = priceDkk;
  const platformDkk = Math.max(Math.round(priceDkk * feePct / 100), feeMinDkk);
  return { shelterDkk, platformDkk, totalDkk: shelterDkk + platformDkk };
}

/**
 * Create a Stripe Checkout Session for a booking.
 * Returns { url, sessionId } — intentionally richer than the spec's Promise<string>
 * because the caller also needs the session ID to insert into booking_payments.
 * Note: expires_at max is 24h from now (Stripe limit).
 */
export async function createCheckoutSession(
  booking: ShelterBooking,
  shelter: BookableShelter
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const priceDkk = shelter.shelter_price_dkk ?? 0;
  const { shelterDkk, platformDkk } = calculateFee(
    priceDkk,
    shelter.platform_fee_pct,
    shelter.platform_fee_min_dkk
  );

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (shelterDkk > 0) {
    lineItems.push({
      price_data: {
        currency: "dkk",
        product_data: { name: `Overnatning: ${shelter.title}` },
        unit_amount: shelterDkk * 100, // øre
      },
      quantity: 1,
    });
  }

  lineItems.push({
    price_data: {
      currency: "dkk",
      product_data: { name: "Administrationsgebyr (ShelterDK)" },
      unit_amount: platformDkk * 100, // øre
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["mobilepay", "card"],
    line_items: lineItems,
    metadata: { booking_id: booking.id },
    success_url: `${SITE_URL}/booking/${booking.id}/tak`,
    cancel_url: `${SITE_URL}/booking/${booking.id}/betal`,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  });

  if (!session.url) throw new Error("Stripe session created but no URL returned");
  return { url: session.url, sessionId: session.id };
}

/**
 * Verify and construct a Stripe webhook event.
 * `body` MUST be the raw request body string — do NOT pass parsed JSON.
 */
export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(body, signature, secret);
}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/stripe.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/stripe.ts web/lib/__tests__/stripe.test.ts web/package.json web/package-lock.json
git commit -m "feat: add stripe lib with calculateFee; 6 tests passing"
```

---

### Task 4: Payment Database Functions

**Files:**
- Create: `web/lib/payment-db.ts`

- [ ] **Step 1: Create `web/lib/payment-db.ts`**

```typescript
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
  Array<BookingPayment & {
    shelter_title: string;
    guest_name: string;
    check_in: string;
    check_out: string;
  }>
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | grep "payment-db"
```

Expected: No errors for this file.

- [ ] **Step 3: Commit**

```bash
git add web/lib/payment-db.ts
git commit -m "feat: add payment-db helpers (createBookingPayment, expire, payouts)"
```

---

### Task 5: Payment Email Templates

**Files:**
- Modify: `web/lib/booking-email.ts`

The existing file (`booking-email.ts`) already has `getResend`, `FROM_EMAIL`, `esc`, `formatDate`. Append three new exported functions at the end of the file.

- [ ] **Step 1: Append to `web/lib/booking-email.ts`**

```typescript
/** Til gæsten: betalingslink efter ejerens bekræftelse */
export async function sendPaymentRequestToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
  paymentUrl: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Betal din booking af ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Din booking er klar til betaling</h2>
        <p>Hej ${esc(opts.guestName)}!</p>
        <p>Ejeren har bekræftet din booking af <strong>${esc(opts.shelterTitle)}</strong>
           fra <strong>${esc(formatDate(opts.checkIn))}</strong>
           til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          ${opts.amountShelterDkk > 0
            ? `<tr><td style="padding:8px;color:#666;">Overnatning</td><td style="padding:8px;text-align:right;">${opts.amountShelterDkk} kr</td></tr>`
            : ""}
          <tr style="background:#f9f9f9;">
            <td style="padding:8px;color:#666;">Administrationsgebyr</td>
            <td style="padding:8px;text-align:right;">${opts.amountPlatformDkk} kr</td>
          </tr>
          <tr style="font-weight:bold;border-top:2px solid #eee;">
            <td style="padding:8px;">I alt</td>
            <td style="padding:8px;text-align:right;">${opts.amountTotalDkk} kr</td>
          </tr>
        </table>
        <p><strong>Bemærk:</strong> Betalingslinket udløber om 24 timer.</p>
        <div style="margin:24px 0;">
          <a href="${opts.paymentUrl}"
             style="background:#c5a059;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Betal nu via MobilePay
          </a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst betaling): " + JSON.stringify(error));
}

/** Til gæst + ejer: betaling gennemført */
export async function sendPaymentConfirmed(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Betaling modtaget – booking bekræftet! 🎉",
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#16a34a;">Betaling modtaget – god tur! 🎉</h2>
          <p>Hej ${esc(opts.guestName)}!</p>
          <p>Vi har modtaget din betaling på <strong>${opts.amountTotalDkk} kr</strong>
             for <strong>${esc(opts.shelterTitle)}</strong>
             fra <strong>${esc(formatDate(opts.checkIn))}</strong>
             til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
          <p>Din booking er nu bekræftet. <strong>God tur!</strong></p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Betaling modtaget: ${esc(opts.shelterTitle)}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#16a34a;">Betaling modtaget</h2>
          <p>${esc(opts.guestName)} har betalt <strong>${opts.amountTotalDkk} kr</strong>
             for <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (betaling gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (betaling ejer): " + JSON.stringify(r2.error));
}

/** Til gæst + ejer: booking annulleret pga. manglende betaling */
export async function sendBookingExpired(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Din booking er udløbet",
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#dc2626;">Din booking er udløbet</h2>
          <p>Hej ${esc(opts.guestName)},</p>
          <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))})
             er desværre annulleret, da betalingsfristen på 24 timer ikke blev overholdt.</p>
          <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a>.</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Booking udløbet — dato er ledig igen`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#dc2626;">Booking udløbet</h2>
          <p>Bookingen fra ${esc(opts.guestName)} af <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))})
             er annulleret, da gæsten ikke betalte inden for 24 timer.
             Datoen er ledig igen.</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (udløbet gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (udløbet ejer): " + JSON.stringify(r2.error));
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/booking-email.ts
git commit -m "feat: add payment email templates (request, confirmed, expired)"
```

---

### Task 6: Extend Owner Action Route

**Files:**
- Modify: `web/app/api/owner/[token]/action/route.ts`

The current route handles `"confirm"` and `"reject"`. We extend `"confirm"` to create a Stripe Checkout Session after updating booking status, and add `"resend-payment"`.

**Intentional change:** The existing `confirm` branch sends `sendBookingConfirmedToGuest`. This is **replaced** by `sendPaymentRequestToGuest` — the guest now gets the payment link instead of a direct confirmation. The actual "confirmed" email is sent later by the Stripe webhook after payment completes. If Stripe setup fails (the `try/catch` path), the booking is still confirmed in the DB — the admin can resend the payment link from the dashboard.

- [ ] **Step 1: Replace the file content**

Full replacement of `web/app/api/owner/[token]/action/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import {
  sendBookingRejectedToGuest,
  sendPaymentRequestToGuest,
} from "@/lib/booking-email";
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment, getPaymentByBookingId } from "@/lib/payment-db";

export const dynamic = "force-dynamic";

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

  if (!bookingId || !["confirm", "reject", "resend-payment"].includes(action))
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

    await updateBookingStatus(bookingId, "confirmed");

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const { shelterDkk, platformDkk, totalDkk } = calculateFee(
        shelter.shelter_price_dkk ?? 0,
        shelter.platform_fee_pct,
        shelter.platform_fee_min_dkk
      );
      await createBookingPayment({
        bookingId,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
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
      });
    } catch (err) {
      console.error("owner confirm: payment setup error:", err);
      // Booking is confirmed but no payment row — admin can resend via dashboard
    }

    return NextResponse.json({ ok: true });
  }

  // ── reject ───────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (booking.status !== "pending")
      return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

    await updateBookingStatus(bookingId, "rejected");

    try {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    } catch (err) {
      console.error("owner reject email error:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // ── resend-payment ───────────────────────────────────────────────────────
  if (action === "resend-payment") {
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

    const existing = await getPaymentByBookingId(bookingId);
    if (existing?.status === "paid")
      return NextResponse.json({ error: "Betaling allerede gennemført" }, { status: 409 });

    try {
      const { url, sessionId } = await createCheckoutSession(booking, shelter);
      const { shelterDkk, platformDkk, totalDkk } = calculateFee(
        shelter.shelter_price_dkk ?? 0,
        shelter.platform_fee_pct,
        shelter.platform_fee_min_dkk
      );
      await createBookingPayment({
        bookingId,
        stripeCheckoutSessionId: sessionId,
        amountTotalDkk: totalDkk,
        amountShelterDkk: shelterDkk,
        amountPlatformDkk: platformDkk,
      });
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
      });
    } catch (err) {
      console.error("resend-payment error:", err);
      return NextResponse.json({ error: "Kunne ikke sende betalingslink" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | grep "action/route"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/owner/[token]/action/route.ts"
git commit -m "feat: extend owner action route with Stripe payment on confirm and resend-payment"
```

---

### Task 7: Stripe Webhook Handler

**Files:**
- Create: `web/app/api/stripe/webhook/route.ts`

**Critical:** Stripe signature verification requires the raw request body. Use `req.text()`, never `req.json()`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/CKA/shelterdk/web/app/api/stripe/webhook
```

- [ ] **Step 2: Create `web/app/api/stripe/webhook/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { getPaymentBySessionId, markPaymentPaid } from "@/lib/payment-db";
import { sendPaymentConfirmed } from "@/lib/booking-email";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

// IMPORTANT: Do NOT parse body as JSON — Stripe needs the raw bytes for signature verification
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = constructWebhookEvent(body, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("Stripe webhook error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string };

    const payment = await getPaymentBySessionId(session.id);
    if (!payment) {
      // Session not in our DB — log and acknowledge (don't retry)
      console.error("Webhook: no payment row for session", session.id);
      return NextResponse.json({ ok: true });
    }

    // Idempotent: already processed
    if (payment.paid_at) return NextResponse.json({ ok: true });

    await markPaymentPaid(payment.id);

    // Send confirmation emails (non-critical — don't fail the webhook)
    try {
      const { data: booking } = await createAdminClient()
        .from("bookings")
        .select("guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, title)")
        .eq("id", payment.booking_id)
        .single();

      if (booking) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shelter = (booking as any).bookable_shelters;
        await sendPaymentConfirmed({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          ownerEmail: shelter.owner_email,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          amountTotalDkk: payment.amount_total_dkk,
        });
      }
    } catch (err) {
      console.error("Webhook: email failed (non-fatal):", err);
    }
  }

  // checkout.session.expired is intentionally unhandled — nightly cron is authoritative

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/stripe/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for checkout.session.completed"
```

---

### Task 8: Expire-Payments Cron

**Files:**
- Create: `web/app/api/cron/expire-payments/route.ts`
- Create: `web/netlify/functions/expire-payments-cron.ts`

- [ ] **Step 1: Create cron API endpoint**

Create `web/app/api/cron/expire-payments/route.ts`:

```typescript
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
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);

      const { data: booking } = await createAdminClient()
        .from("bookings")
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
```

- [ ] **Step 2: Create Netlify scheduled function**

Create `web/netlify/functions/expire-payments-cron.ts`:

```typescript
import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/expire-payments`,
      { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } }
    );
    const body = await res.text();
    console.log("expire-payments-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("expire-payments-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 2 * * *", handler); // 02:00 UTC daily
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/cron/expire-payments/route.ts \
        web/netlify/functions/expire-payments-cron.ts
git commit -m "feat: add expire-payments cron (API + Netlify scheduled function, 02:00 UTC)"
```

---

### Task 9: Guest Payment Pages

**Files:**
- Create: `web/app/(site)/booking/[id]/betal/page.tsx`
- Create: `web/app/(site)/booking/[id]/tak/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/CKA/shelterdk/web/app/(site)/booking/[id]/betal"
mkdir -p "/Users/CKA/shelterdk/web/app/(site)/booking/[id]/tak"
```

- [ ] **Step 2: Create payment page**

Create `web/app/(site)/booking/[id]/betal/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getPaymentByBookingId } from "@/lib/payment-db";
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment } from "@/lib/payment-db";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function BetalPage({ params }: Props) {
  const { id } = await params;

  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("*, bookable_shelters!inner(*)")
    .eq("id", id)
    .single();

  if (!booking || booking.status === "cancelled" || booking.status === "rejected") {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shelter = (booking as any).bookable_shelters;
  const payment = await getPaymentByBookingId(id);

  if (payment?.status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">Betaling gennemført</h1>
          <p className="text-primary/60">
            Din betaling er registreret. Du modtager en bekræftelse på e-mail.
          </p>
        </div>
      </div>
    );
  }

  const priceDkk = shelter.shelter_price_dkk ?? 0;
  const feePct = shelter.platform_fee_pct ?? 5;
  const feeMin = shelter.platform_fee_min_dkk ?? 25;
  const { shelterDkk, platformDkk, totalDkk } = calculateFee(priceDkk, feePct, feeMin);

  let checkoutUrl: string | null = null;
  if (booking.status === "confirmed") {
    try {
      // Reuse existing active session to avoid creating orphaned Stripe sessions
      // on every page load. Only create a new session if none is pending/active.
      const hasActivePendingPayment =
        payment &&
        payment.status === "pending" &&
        new Date(payment.expires_at) > new Date();

      if (hasActivePendingPayment) {
        // Retrieve URL from existing Stripe session
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(
          payment.stripe_checkout_session_id
        );
        checkoutUrl = session.url ?? null;
      } else {
        // No active session — create a new one (first visit or session expired)
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        await createBookingPayment({
          bookingId: id,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        checkoutUrl = url;
      }
    } catch (err) {
      console.error("betal page: checkout error:", err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold text-primary mb-1">{shelter.title}</h1>
        <p className="text-primary/50 text-sm mb-6">
          {new Date(booking.check_in).toLocaleDateString("da-DK", { day: "numeric", month: "long" })}
          {" – "}
          {new Date(booking.check_out).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-2 mb-6">
          {shelterDkk > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-primary/60">Overnatning</span>
              <span>{shelterDkk} kr</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-primary/60">Administrationsgebyr</span>
            <span>{platformDkk} kr</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2 mt-2">
            <span>I alt</span>
            <span>{totalDkk} kr</span>
          </div>
        </div>

        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="block w-full text-center bg-[#c5a059] text-white font-semibold py-3 rounded-xl hover:bg-[#b38f48] transition-colors"
          >
            Betal nu via MobilePay
          </a>
        ) : (
          <p className="text-center text-primary/50 text-sm">
            {booking.status === "pending"
              ? "Booking afventer bekræftelse fra ejeren."
              : "Kontakt os for hjælp til din booking."}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create success page**

Create `web/app/(site)/booking/[id]/tak/page.tsx`:

```typescript
export const dynamic = "force-dynamic";

export default function TakPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-green-700 mb-3">Betaling modtaget!</h1>
        <p className="text-primary/60 mb-6">
          Tak for din betaling. Du modtager en bekræftelse på e-mail inden for få minutter.
        </p>
        <a
          href="/"
          className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition"
        >
          Tilbage til forsiden
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "web/app/(site)/booking/"
git commit -m "feat: add guest payment page and success page"
```

---

### Task 10: Owner Payments API + Settings Extension

**Files:**
- Create: `web/app/api/owner/[token]/payments/route.ts`
- Modify: `web/app/api/owner/[token]/settings/route.ts`

- [ ] **Step 1: Create payments endpoint**

Create `web/app/api/owner/[token]/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, getBookingsForShelter } from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const bookings = await getBookingsForShelter(shelter.id);
  if (bookings.length === 0) return NextResponse.json([]);

  const bookingIds = bookings.map((b) => b.id);
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("booking_id, status, amount_total_dkk, amount_shelter_dkk, amount_platform_dkk")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep only the most recent payment per booking
  const seen = new Set<string>();
  const deduped = (data ?? []).filter((p) => {
    if (seen.has(p.booking_id)) return false;
    seen.add(p.booking_id);
    return true;
  });

  return NextResponse.json(deduped);
}
```

- [ ] **Step 2: Extend settings route to handle shelter_price_dkk**

Read `web/app/api/owner/[token]/settings/route.ts` (already read — it handles `ical_import_url`). Add price handling before the `await saveIcalImportUrl` call.

In the PATCH handler, after `const body = await req.json().catch(...)`, add:

```typescript
  // Handle shelter price update
  if ("shelter_price_dkk" in body) {
    const raw = body.shelter_price_dkk;
    const priceDkk = raw === null || raw === "" ? null : Number(raw);
    if (priceDkk !== null && (isNaN(priceDkk) || priceDkk < 0)) {
      return NextResponse.json({ error: "Ugyldig pris" }, { status: 400 });
    }
    const { error: priceError } = await (await import("@/utils/supabase/server-admin"))
      .createAdminClient()
      .from("bookable_shelters")
      .update({ shelter_price_dkk: priceDkk })
      .eq("id", shelter.id);
    if (priceError) return NextResponse.json({ error: priceError.message }, { status: 500 });

    // If only price was sent (no ical fields), return early
    if (!("ical_import_url" in body)) return NextResponse.json({ ok: true });
  }
```

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/owner/[token]/payments/route.ts" \
        "web/app/api/owner/[token]/settings/route.ts"
git commit -m "feat: add owner payments endpoint and shelter_price_dkk to settings"
```

---

### Task 11: Owner Dashboard — Payment UI

**Files:**
- Modify: `web/components/owner/OwnerDashboard.tsx`

The dashboard is a large client component. Read the full file before editing to find exact insertion points.

- [ ] **Step 1: Read the full OwnerDashboard**

```bash
wc -l /Users/CKA/shelterdk/.worktrees/feature-booking/web/components/owner/OwnerDashboard.tsx
```

Then read the file in sections using the Read tool to find:
1. Where booking cards render booking status (search for `booking.status`)
2. Where the confirm/reject button click handler is (`handleConfirm` or similar fetch call)
3. Where shelter settings form is (search for `ical_import_url`)
4. The top of the component to understand state variables

- [ ] **Step 2: Add PaymentInfo type and state**

At the top of the component (after existing imports), add the type:

```typescript
type PaymentInfo = {
  booking_id: string;
  status: "pending" | "paid" | "failed" | "expired";
  amount_total_dkk: number;
  amount_shelter_dkk: number;
  amount_platform_dkk: number;
};
```

In the component body, add state and fetch function after existing state declarations:

```typescript
const [payments, setPayments] = useState<PaymentInfo[]>([]);

const fetchPayments = useCallback(async () => {
  try {
    const res = await fetch(`/api/owner/${ownerToken}/payments`);
    if (res.ok) setPayments(await res.json());
  } catch { /* non-critical */ }
}, [ownerToken]);
```

Add a `useEffect` to call `fetchPayments` on mount (add alongside any existing useEffect):

```typescript
useEffect(() => { void fetchPayments(); }, [fetchPayments]);
```

- [ ] **Step 3: Add resend handler**

Add this function inside the component, alongside existing handlers:

```typescript
const handleResendPayment = async (bookingId: string) => {
  const res = await fetch(`/api/owner/${ownerToken}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId, action: "resend-payment" }),
  });
  if (res.ok) {
    alert("Betalingslink gensendt til gæsten.");
    await fetchPayments();
  } else {
    const data = await res.json().catch(() => ({}));
    alert((data as { error?: string }).error ?? "Fejl ved gensendelse.");
  }
};
```

- [ ] **Step 4: Add fetchPayments call after confirm action**

Find the existing confirm action handler (the fetch call to `/api/owner/${ownerToken}/action` with `action: "confirm"`). After `if (res.ok)` handling, add:

```typescript
await fetchPayments();
```

- [ ] **Step 5: Add payment status to booking cards**

Find where `booking.status` is displayed in the booking card JSX. After the status badge (look for `"Bekræftet"` or `"confirmed"` text), add:

```typescript
{(() => {
  const p = payments.find((x) => x.booking_id === booking.id);
  if (!p) return null;
  if (p.status === "paid") return (
    <p className="text-xs text-green-600 font-medium mt-1">
      ✓ Betalt ({p.amount_total_dkk} kr)
    </p>
  );
  if (p.status === "pending") return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      <span className="text-xs text-yellow-600 font-medium">
        Afventer betaling ({p.amount_total_dkk} kr)
      </span>
      <button
        onClick={() => handleResendPayment(booking.id)}
        className="text-xs underline text-primary/40 hover:text-primary transition-colors"
      >
        Gensend link
      </button>
    </div>
  );
  if (p.status === "expired") return (
    <p className="text-xs text-red-500 font-medium mt-1">Betaling udløbet</p>
  );
  return null;
})()}
```

- [ ] **Step 6: Add price-per-night field to shelter settings**

Find the settings section (near `ical_import_url` field). Add a price field:

```typescript
// State (add alongside ical state)
const [pricePerNight, setPricePerNight] = useState<string>(
  shelter.shelter_price_dkk != null ? String(shelter.shelter_price_dkk) : ""
);
```

In the settings form JSX, add before or after the iCal URL field:

```typescript
<div>
  <label className="block text-sm font-medium text-primary/70 mb-1">
    Pris per nat (kr)
  </label>
  <input
    type="number"
    min="0"
    value={pricePerNight}
    onChange={(e) => setPricePerNight(e.target.value)}
    placeholder="Gratis (lad stå tomt)"
    className="w-full border border-primary/20 rounded-lg px-3 py-2 text-sm"
  />
  <p className="text-xs text-primary/40 mt-1">
    ShelterDK tillægger altid et administrationsgebyr ovenpå.
  </p>
</div>
```

In the settings save handler, include price in the PATCH body:

```typescript
shelter_price_dkk: pricePerNight === "" ? null : Number(pricePerNight),
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | grep -i "OwnerDashboard\|payment" | head -10
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat: owner dashboard — payment status badges, resend button, price field"
```

---

### Task 12: Admin Payments & Payouts

**Files:**
- Create: `web/app/api/admin/payments/route.ts`
- Create: `web/app/api/admin/payouts/route.ts`
- Create: `web/app/api/admin/payouts/[id]/route.ts`
- Create: `web/app/(site)/admin/payments/page.tsx`

- [ ] **Step 0: Check for existing shared isAdmin helper**

```bash
grep -r "isAdmin\|is_admin\|adminSecret" /Users/CKA/shelterdk/web/lib/ 2>/dev/null | head -5
grep -r "function isAdmin" /Users/CKA/shelterdk/web/app/api/admin/ | head -5
```

**If a shared helper already exists** (e.g. in `web/lib/admin-auth.ts`): import from it in all three routes below instead of inlining.

**If no shared helper exists**: create `web/lib/admin-auth.ts` with the following, then import it in all three admin routes:

```typescript
import { NextRequest } from "next/server";

export function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length === 0) return false;
  const header = req.headers.get("x-admin-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || query === secret;
}
```

The three routes below use `isAdmin` from this shared file (replace any inline copy with `import { isAdmin } from "@/lib/admin-auth"`).

- [ ] **Step 1: Create payments API**

Create `web/app/api/admin/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getPaymentsForAdmin } from "@/lib/payment-db";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payments = await getPaymentsForAdmin();
  return NextResponse.json(payments);
}
```

- [ ] **Step 2: Create payouts API**

Create `web/app/api/admin/payouts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createOwnerPayout, getPayoutsForAdmin } from "@/lib/payment-db";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getPayoutsForAdmin());
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { shelter_id, period_start, period_end, amount_dkk } = body;
  if (!shelter_id || !period_start || !period_end || !amount_dkk)
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  await createOwnerPayout({
    shelterId: shelter_id,
    periodStart: period_start,
    periodEnd: period_end,
    amountDkk: Number(amount_dkk),
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create payout mark-paid endpoint**

Create `web/app/api/admin/payouts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { markPayoutPaid } from "@/lib/payment-db";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await markPayoutPaid(id, body.notes ?? null);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create admin UI page**

**Note on tabs:** The spec says "two tabs". For MVP, this page uses two stacked sections on a single server-rendered page — simpler, no client JS needed, same content. Tab UI can be added later if desired (would require converting to a client component with `useState`).

Create `web/app/(site)/admin/payments/page.tsx`:

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { getPaymentsForAdmin, getPayoutsForAdmin } from "@/lib/payment-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Betalinger | ShelterDK" },
};

function Badge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    expired: "bg-red-100 text-red-500",
    failed: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    paid: "Betalt", pending: "Afventer", expired: "Udløbet", failed: "Fejlet",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default async function AdminPaymentsPage() {
  const [payments, payouts] = await Promise.all([
    getPaymentsForAdmin(),
    getPayoutsForAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-12">
      <nav className="mb-2 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Betalinger</span>
      </nav>

      <section>
        <h1 className="text-2xl font-bold text-primary mb-6">
          Transaktioner ({payments.length})
        </h1>
        <div className="overflow-x-auto rounded-xl border border-primary/10">
          <table className="w-full text-sm">
            <thead className="border-b border-primary/10 bg-primary/2">
              <tr>
                {["Shelter","Gæst","Datoer","Total","Gebyr","Status","Oprettet"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-primary/50 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-primary/5 hover:bg-primary/2">
                  <td className="px-4 py-3 font-medium">{p.shelter_title}</td>
                  <td className="px-4 py-3 text-primary/70">{p.guest_name}</td>
                  <td className="px-4 py-3 text-primary/50 text-xs">{p.check_in} – {p.check_out}</td>
                  <td className="px-4 py-3 text-right">{p.amount_total_dkk} kr</td>
                  <td className="px-4 py-3 text-right text-primary/60">{p.amount_platform_dkk} kr</td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-primary/40 text-xs">
                    {new Date(p.created_at).toLocaleDateString("da-DK")}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-primary/30">Ingen transaktioner endnu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-primary mb-6">
          Udbetalinger ({payouts.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-primary/10">
          <table className="w-full text-sm">
            <thead className="border-b border-primary/10 bg-primary/2">
              <tr>
                {["Shelter","Periode","Beløb","Status","Udbetalt","Note"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-primary/50 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-primary/5">
                  <td className="px-4 py-3 font-medium">{p.shelter_title}</td>
                  <td className="px-4 py-3 text-primary/50 text-xs">{p.period_start} – {p.period_end}</td>
                  <td className="px-4 py-3 text-right">{p.amount_dkk} kr</td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-primary/40 text-xs">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("da-DK") : "—"}
                  </td>
                  <td className="px-4 py-3 text-primary/40 text-xs">{p.notes ?? "—"}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-primary/30">Ingen udbetalinger endnu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: All tests pass (6 calculateFee tests + all existing tests).

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add web/app/api/admin/payments/ \
        web/app/api/admin/payouts/ \
        "web/app/(site)/admin/payments/"
git commit -m "feat: add admin payments and payouts API routes and UI page"
```

---

## Miljøvariabler

Tilføj til Netlify environment (og `.env.local` til lokal test):

```
STRIPE_SECRET_KEY=sk_test_...        # Fra Stripe dashboard
STRIPE_WEBHOOK_SECRET=whsec_...      # Fra Stripe dashboard → Webhooks → dit endpoint
# Allerede i projektet:
# CRON_SECRET                        # Genbruges til expire-payments cron
# ADMIN_SECRET                       # Genbruges til admin API routes
```

**Stripe dashboard setup (manuelt, før test):**
1. Aktivér MobilePay under Settings → Payment methods
2. Opret webhook endpoint: `https://<site>/api/stripe/webhook`
3. Lyt på: `checkout.session.completed`
4. Kopiér webhook signing secret til `STRIPE_WEBHOOK_SECRET`

---

## Manuel verifikation

1. **Gratis shelter (0 kr):** Bekræft booking → gæst får mail med 25 kr total → Stripe link viser MobilePay + kort
2. **Betalt shelter 100 kr:** Total = 125 kr (100 + 25 minimum)
3. **Betalt shelter 700 kr:** Total = 735 kr (700 + 35 pct)
4. **Webhook test (Stripe CLI):** `stripe trigger checkout.session.completed` → payment status = paid → bekræftelses-e-mails
5. **Udløb:** Sæt `expires_at = now() - 1 minute` i DB → kald `/api/cron/expire-payments?secret=...` → booking annulleres
6. **Gensend link:** Dashboard → "Gensend link" → ny mail til gæst
7. **Admin UI:** Åbn `/admin/payments` → transaktioner og udbetalinger vises
8. **Gæsteside:** `/booking/[id]/betal` viser beløbsoversigt og "Betal nu"-knap
