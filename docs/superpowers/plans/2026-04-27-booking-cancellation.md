# Booking Cancellation Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let both owners and guests cancel confirmed bookings with automatic Stripe refunds, email notifications, and a permanent guest-facing "Min booking" page at `/min-booking/[guestToken]`.

**Architecture:** Guest page is server-rendered at `/min-booking/[guestToken]` (distinct from existing `/booking/[id]/`). Two cancel routes: `POST /api/booking/[guestToken]/cancel` for guests and a new `"cancel"` action in the existing `POST /api/owner/[token]/action` route. `cancelBooking()` is a race-safe helper that guards with `WHERE status = 'confirmed'`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (admin client), Stripe (checkout session → payment_intent refund), Resend (email)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/supabase/migrations/20260427_booking_cancellation.sql` | **CREATE** | Add `guest_token`, `cancelled_at`, `cancelled_by`, `cancellation_cutoff_hours` |
| `web/types/booking.ts` | **MODIFY** | Add new fields to `BookableShelter`, `ShelterBooking`, `BookingAction` |
| `web/lib/booking-db.ts` | **MODIFY** | Add `getBookingByGuestToken`, `cancelBooking`, `getBookableShelterByPk`, `isRefundEligible` |
| `web/lib/booking-email.ts` | **MODIFY** | Add 3 cancel email fns; add `guestToken` param + link to 3 existing fns |
| `web/app/api/booking/[guestToken]/cancel/route.ts` | **CREATE** | Guest cancel endpoint |
| `web/app/api/owner/[token]/action/route.ts` | **MODIFY** | Add `"cancel"` action |
| `web/app/api/owner/[token]/settings/route.ts` | **MODIFY** | Handle `cancellation_cutoff_hours` |
| `web/app/api/booking/action/[token]/route.ts` | **MODIFY** | Pass `guestToken` to `sendBookingConfirmedToGuest` |
| `web/app/api/stripe/webhook/route.ts` | **MODIFY** | Pass `guestToken` to `sendPaymentConfirmed` |
| `web/app/(site)/min-booking/[guestToken]/page.tsx` | **CREATE** | Server component — fetch data, compute display values |
| `web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx` | **CREATE** | Client component — cancel dialog, loading state, post-cancel view |
| `web/components/owner/OwnerDashboard.tsx` | **MODIFY** | Cancel button + inline confirm panel; "Afbestillingsregler" section |
| `web/lib/__tests__/booking-cancellation.test.ts` | **CREATE** | Unit tests for `isRefundEligible` |

---

## Task 1: Database Migration

**Files:**
- Create: `web/supabase/migrations/20260427_booking_cancellation.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 20260427_booking_cancellation.sql

-- Add cancellation fields to shelter_bookings
-- PostgreSQL 12+: NOT NULL DEFAULT backfills existing rows inline — no manual UPDATE needed.
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS guest_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('owner', 'guest', 'system'));
-- 'system' is reserved for future automated cancellation (e.g. post-expiry).
-- status CHECK constraint already includes 'cancelled' (see 20260424_booking_tables.sql).

CREATE UNIQUE INDEX IF NOT EXISTS shelter_bookings_guest_token_unique
  ON shelter_bookings (guest_token);

-- Add configurable refund cutoff to bookable_shelters (default: 48 hours)
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INT NOT NULL DEFAULT 48;
```

- [ ] **Step 2: Apply in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste the migration → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260427_booking_cancellation.sql
git commit -m "feat: add booking cancellation schema (guest_token, cancelled_at, cutoff_hours)"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `web/types/booking.ts`

- [ ] **Step 1: Add fields to `BookableShelter`**

In `web/types/booking.ts`, after `payment_mode: "after_confirmation" | "upfront";`:

```typescript
  cancellation_cutoff_hours: number; // default 48
```

- [ ] **Step 2: Add fields to `ShelterBooking`**

In `web/types/booking.ts`, after `updated_at: string;` in `ShelterBooking`:

```typescript
  guest_token: string;
  cancelled_at: string | null;
  cancelled_by: "owner" | "guest" | "system" | null;
```

- [ ] **Step 3: Update `BookingAction` type**

Change:
```typescript
export type BookingAction = "confirm" | "reject";
```
To:
```typescript
export type BookingAction = "confirm" | "reject" | "cancel";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add web/types/booking.ts
git commit -m "feat: add cancellation fields to booking types"
```

---

## Task 3: DB Helpers + `isRefundEligible` (TDD)

**Files:**
- Modify: `web/lib/booking-db.ts`
- Create: `web/lib/__tests__/booking-cancellation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/booking-cancellation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isRefundEligible } from "@/lib/booking-db";

describe("isRefundEligible", () => {
  it("returns true when check_in is more than cutoff hours away", () => {
    // check_in midnight UTC on Jun 1 = 2026-06-01T00:00:00Z
    // now = May 28 12:00 UTC → 84 hours away → > 48h cutoff
    const now = new Date("2026-05-28T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(true);
  });

  it("returns false when check_in is less than cutoff hours away", () => {
    // now = May 31 12:00 UTC → 12 hours away → < 48h cutoff
    const now = new Date("2026-05-31T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("returns false when exactly at cutoff (strictly greater required)", () => {
    // now = May 30 00:00 UTC → exactly 48 hours to Jun 1 midnight UTC
    const now = new Date("2026-05-30T00:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("handles 168h (7 days) cutoff", () => {
    const now = new Date("2026-05-20T00:00:00Z"); // 12 days before Jun 1
    expect(isRefundEligible("2026-06-01", 168, now)).toBe(true);
  });

  it("handles 24h cutoff where just outside", () => {
    const now = new Date("2026-05-30T20:00:00Z"); // ~28h before Jun 1 midnight UTC
    expect(isRefundEligible("2026-06-01", 24, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd web && npx vitest run lib/__tests__/booking-cancellation.test.ts
```
Expected: FAIL — `isRefundEligible is not a function`

- [ ] **Step 3: Implement `isRefundEligible` in `lib/booking-db.ts`**

Add after the existing imports at the top of `lib/booking-db.ts`:

```typescript
// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if a guest can get a full refund based on how far away check_in is.
 * check_in is a date string "YYYY-MM-DD" interpreted as midnight UTC.
 * now defaults to current time — pass explicitly in tests for determinism.
 */
export function isRefundEligible(
  checkIn: string,
  cutoffHours: number,
  now: Date = new Date()
): boolean {
  const hoursUntilCheckIn = (new Date(checkIn).getTime() - now.getTime()) / 3_600_000;
  return hoursUntilCheckIn > cutoffHours;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd web && npx vitest run lib/__tests__/booking-cancellation.test.ts
```
Expected: 5 tests pass

- [ ] **Step 5: Add `getBookingByGuestToken` helper**

In `lib/booking-db.ts`, add after the existing `getBookingByIdForShelter` function:

```typescript
/** Look up a booking by its guest_token UUID (guest page auth). */
export async function getBookingByGuestToken(
  guestToken: string
): Promise<ShelterBooking | null> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("guest_token", guestToken)
    .maybeSingle();
  return data as ShelterBooking | null;
}
```

- [ ] **Step 6: Add `cancelBooking` helper**

In `lib/booking-db.ts`, add after `getBookingByGuestToken`:

```typescript
/**
 * Mark a booking as cancelled. Only succeeds if current status is 'confirmed'
 * (race-condition safe — concurrent requests get 409 from the API).
 * Returns true if the row was actually updated (false = already not confirmed).
 */
export async function cancelBooking(
  bookingId: string,
  cancelledBy: "owner" | "guest"
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("shelter_bookings")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_by: cancelledBy,
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");
  if (error) throw new Error("cancelBooking: " + error.message);
  return (data ?? []).length > 0;
}
```

- [ ] **Step 7: Add `getBookableShelterByPk` helper**

In `lib/booking-db.ts`, add after the other shelter lookup functions:

```typescript
/** Look up a bookable shelter by its primary key (id). */
export async function getBookableShelterByPk(
  id: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 9: Run full test suite**

```bash
cd web && npx vitest run
```
Expected: All tests pass (new 5 + existing).

- [ ] **Step 10: Commit**

```bash
git add web/lib/booking-db.ts web/lib/__tests__/booking-cancellation.test.ts
git commit -m "feat: add isRefundEligible, getBookingByGuestToken, cancelBooking, getBookableShelterByPk"
```

---

## Task 4: Email Functions

**Files:**
- Modify: `web/lib/booking-email.ts`

Add a local helper `bookingLink` at the top of the file (after `const SITE_URL`) for reuse:

- [ ] **Step 1: Add `bookingLink` helper and 3 new email functions**

Open `web/lib/booking-email.ts`. Add the helper and new functions after the existing `sendBookingAutoMessage` block:

```typescript
// ─── Helper ───────────────────────────────────────────────────────────────────

function bookingLink(guestToken: string): string {
  return `${SITE_URL}/min-booking/${guestToken}`;
}
```

Then add these three functions at the end of the file:

```typescript
/** Til gæsten (booking.guest_email): gæsten har selv annulleret */
export async function sendGuestCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  guestToken: string;
  refunded: boolean;
}) {
  const refundLine = opts.refunded
    ? `<p style="color:#16a34a;">Du modtager fuld refund inden for 5-10 hverdage.</p>`
    : `<p style="color:#666;">Ingen refund iht. afbestillingspolitikken.</p>`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Din booking er annulleret</h2>
        <p>Hej ${esc(opts.guestName)},</p>
        <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong>
           (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er annulleret.</p>
        ${refundLine}
        <p><a href="${bookingLink(opts.guestToken)}">Se din booking</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst annulleret → gæst): " + JSON.stringify(error));
}

/** Til ejeren (shelter.owner_email): en gæst har annulleret */
export async function sendGuestCancelledToOwner(opts: {
  ownerEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  refunded: boolean;
}) {
  const refundLine = opts.refunded
    ? `Refund udstedt automatisk.`
    : `Ingen refund (uden for afbestillingsfristen).`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `${esc(opts.guestName)} har annulleret sin booking`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">${esc(opts.guestName)} har annulleret</h2>
        <p><strong>${esc(opts.guestName)}</strong> har annulleret bookingen af
           <strong>${esc(opts.shelterTitle)}</strong>
           (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).
           ${refundLine}</p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst annulleret → ejer): " + JSON.stringify(error));
}

/** Til gæsten (booking.guest_email): ejeren har annulleret */
export async function sendOwnerCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  shelterSlug: string;
  checkIn: string;
  checkOut: string;
  refunded: boolean;
}) {
  const refundLine = opts.refunded
    ? `<p style="color:#16a34a;">Du modtager fuld refund inden for 5-10 hverdage.</p>`
    : `<p style="color:#666;">Der var ingen betaling at refundere.</p>`;
  const shelterUrl = `${SITE_URL}/shelter/${opts.shelterSlug}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret af ejeren`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Din booking er annulleret af ejeren</h2>
        <p>Hej ${esc(opts.guestName)},</p>
        <p>Ejeren af <strong>${esc(opts.shelterTitle)}</strong> har desværre måttet annullere
           din booking (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).
           Vi beklager ulejligheden.</p>
        ${refundLine}
        <p><a href="${shelterUrl}">Find alternative datoer for ${esc(opts.shelterTitle)}</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ejer annulleret → gæst): " + JSON.stringify(error));
}
```

- [ ] **Step 2: Update `sendBookingConfirmedToGuest` — add `guestToken` param + link**

Find `sendBookingConfirmedToGuest` and update:

**opts signature — add:**
```typescript
  guestToken: string;
```

**HTML — add before the closing `</div>`:**
```typescript
        <p><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se og administrér din booking</a></p>
```

- [ ] **Step 3: Update `sendPaymentRequestToGuest` — add `guestToken` param + link**

Find `sendPaymentRequestToGuest` and update:

**opts signature — add:**
```typescript
  guestToken: string;
```

**HTML — add after the "Betal nu via MobilePay" button div:**
```typescript
        <p style="margin-top:16px;"><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se din booking</a></p>
```

- [ ] **Step 4: Update `sendPaymentConfirmed` — add `guestToken` param + link**

Find `sendPaymentConfirmed` and update:

**opts signature — add:**
```typescript
  guestToken: string;
```

**In the guest email HTML — add before `<p style="color:#999;font-size:12px;">Sendt via`:**
```typescript
          <p><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se din booking</a></p>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: Errors at all call sites that don't yet pass `guestToken` (expected — fix in next task).

- [ ] **Step 6: Commit (email functions only)**

```bash
git add web/lib/booking-email.ts
git commit -m "feat: add cancel email functions, add guestToken+link to 3 existing emails"
```

---

## Task 5: Update Email Call Sites

**Files:**
- Modify: `web/app/api/owner/[token]/action/route.ts`
- Modify: `web/app/api/booking/action/[token]/route.ts`
- Modify: `web/app/api/stripe/webhook/route.ts`

The three email functions updated in Task 4 now require `guestToken`. Update every call site.

- [ ] **Step 1: Update `app/api/owner/[token]/action/route.ts`**

Find all calls to `sendBookingConfirmedToGuest` in this file (line ~101). Add `guestToken: booking.guest_token`:

```typescript
await sendBookingConfirmedToGuest({
  guestEmail: booking.guest_email,
  guestName: booking.guest_name,
  shelterTitle: shelter.title,
  checkIn: booking.check_in,
  checkOut: booking.check_out,
  guestToken: booking.guest_token,   // ← ADD
});
```

Find all calls to `sendPaymentRequestToGuest` (lines ~134, ~229, ~264). Add `guestToken: booking.guest_token` to each:

```typescript
await sendPaymentRequestToGuest({
  // ... existing fields ...
  guestToken: booking.guest_token,   // ← ADD to each call
});
```

- [ ] **Step 2: Update `app/api/booking/action/[token]/route.ts`**

Find the call to `sendBookingConfirmedToGuest` (line ~66). Add `guestToken: booking.guest_token`:

```typescript
await sendBookingConfirmedToGuest({
  guestEmail: booking.guest_email,
  guestName: booking.guest_name,
  shelterTitle: shelter.title,
  checkIn: booking.check_in,
  checkOut: booking.check_out,
  guestToken: booking.guest_token,   // ← ADD
});
```

- [ ] **Step 3: Update `app/api/stripe/webhook/route.ts`**

The webhook queries `shelter_bookings` without selecting `guest_token`. Add it to the select:

```typescript
const { data: booking } = await createAdminClient()
  .from("shelter_bookings")
  .select("guest_token, guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, owner_token, title, payment_mode)")
  .eq("id", payment.booking_id)
  .single();
```

Then add `guestToken: booking.guest_token` to the `sendPaymentConfirmed` call:

```typescript
await sendPaymentConfirmed({
  guestEmail: booking.guest_email,
  guestName: booking.guest_name,
  ownerEmail: shelter.owner_email,
  shelterTitle: shelter.title,
  checkIn: booking.check_in,
  checkOut: booking.check_out,
  amountTotalDkk: payment.amount_total_dkk,
  guestToken: booking.guest_token,   // ← ADD
});
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Run full test suite**

```bash
cd web && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/app/api/owner/\[token\]/action/route.ts \
        web/app/api/booking/action/\[token\]/route.ts \
        web/app/api/stripe/webhook/route.ts
git commit -m "feat: pass guestToken to confirmation emails (booking link for guests)"
```

---

## Task 6: Guest Cancel API

**Files:**
- Create: `web/app/api/booking/[guestToken]/cancel/route.ts`

Note: this directory is nested under the existing `web/app/api/booking/` but uses a different dynamic segment — no conflict.

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getBookingByGuestToken,
  getBookableShelterByPk,
  cancelBooking,
  isRefundEligible,
} from "@/lib/booking-db";
import { getPaymentByBookingId } from "@/lib/payment-db";
import { sendGuestCancelledToGuest, sendGuestCancelledToOwner } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ guestToken: string }> }
) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
  if (!booking)
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  if (booking.status !== "confirmed")
    return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

  // Allow cancellation only strictly before check_in day (Europe/Copenhagen)
  const todayCph = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
  }).format(new Date());
  if (booking.check_in <= todayCph)
    return NextResponse.json({ error: "Annullering er ikke mulig" }, { status: 400 });

  const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
  if (!shelter)
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  const payment = await getPaymentByBookingId(booking.id);
  const fullRefund = isRefundEligible(booking.check_in, shelter.cancellation_cutoff_hours);

  // Attempt Stripe refund (non-fatal — cancellation proceeds regardless)
  let refunded = false;
  let refundError = false;
  if (payment?.status === "paid" && fullRefund) {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id,
        { expand: ["payment_intent"] }
      );
      const pi = session.payment_intent as { id?: string };
      if (pi.id) {
        await stripe.refunds.create({ payment_intent: pi.id });
        refunded = true;
      }
    } catch (err) {
      console.error("guest cancel: Stripe refund error:", err);
      refundError = true;
    }
  }

  // Mark as cancelled — race-condition safe
  const cancelled = await cancelBooking(booking.id, "guest");
  if (!cancelled)
    return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

  // Send emails (non-fatal)
  try {
    await sendGuestCancelledToGuest({
      guestEmail: booking.guest_email,
      guestName: booking.guest_name,
      shelterTitle: shelter.title,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guestToken: booking.guest_token,
      refunded,
    });
  } catch (err) {
    console.error("guest cancel: email to guest failed:", err);
  }

  try {
    await sendGuestCancelledToOwner({
      ownerEmail: shelter.owner_email,
      guestName: booking.guest_name,
      shelterTitle: shelter.title,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      refunded,
    });
  } catch (err) {
    console.error("guest cancel: email to owner failed:", err);
  }

  return NextResponse.json({
    ok: true,
    refunded,
    ...(refundError ? { refundError: true } : {}),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/booking/[guestToken]/cancel/route.ts"
git commit -m "feat: guest cancel API — POST /api/booking/[guestToken]/cancel"
```

---

## Task 7: Owner Cancel Action

**Files:**
- Modify: `web/app/api/owner/[token]/action/route.ts`

- [ ] **Step 1: Add imports**

At the top of the file, add to existing imports:

```typescript
import { cancelBooking } from "@/lib/booking-db";  // add to existing booking-db import
import { sendOwnerCancelledToGuest } from "@/lib/booking-email";  // add to existing email import
import { isRefundEligible } from "@/lib/booking-db";  // same import line as cancelBooking
```

The `booking-db` import line already exists — add `cancelBooking` and `isRefundEligible` to it. The email import line already exists — add `sendOwnerCancelledToGuest` to it.

- [ ] **Step 2: Update valid actions validation**

Find this line (around line 77):
```typescript
if (!bookingId || !["confirm", "reject", "resend-payment"].includes(action))
```
Change to:
```typescript
if (!bookingId || !["confirm", "reject", "resend-payment", "cancel"].includes(action))
```

- [ ] **Step 3: Add cancel block before the final error return**

Add the following block before the last `return NextResponse.json({ error: "Ukendt handling" }, { status: 400 })` line at the bottom of the `POST` handler:

```typescript
  // ── cancel ──────────────────────────────────────────────────────────────────
  if (action === "cancel") {
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

    const payment = await getPaymentByBookingId(bookingId);

    // Owner cancel always gives full refund regardless of timing
    let refunded = false;
    if (payment?.status === "paid") {
      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(
          payment.stripe_checkout_session_id,
          { expand: ["payment_intent"] }
        );
        const pi = session.payment_intent as { id?: string };
        if (pi.id) {
          await stripe.refunds.create({ payment_intent: pi.id });
          refunded = true;
        }
      } catch (err) {
        console.error("owner cancel: Stripe refund error:", err);
        // Non-fatal — continue with cancellation
      }
    }

    const cancelled = await cancelBooking(bookingId, "owner");
    if (!cancelled)
      return NextResponse.json({ error: "Booking er ikke bekræftet" }, { status: 409 });

    try {
      await sendOwnerCancelledToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        shelterSlug: shelter.slug,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        refunded,
      });
    } catch (err) {
      console.error("owner cancel: email to guest failed:", err);
    }

    return NextResponse.json({ ok: true, refunded });
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Run full test suite**

```bash
cd web && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "web/app/api/owner/[token]/action/route.ts"
git commit -m "feat: owner cancel action — POST /api/owner/[token]/action with action=cancel"
```

---

## Task 8: Settings API — Cancellation Cutoff

**Files:**
- Modify: `web/app/api/owner/[token]/settings/route.ts`

- [ ] **Step 1: Add `cancellation_cutoff_hours` handling**

In the `PATCH` handler, after the existing `"shelter_price_dkk"` block and before the `let url = body.ical_import_url` line, insert:

```typescript
  if ("cancellation_cutoff_hours" in body) {
    const hours = Number(body.cancellation_cutoff_hours);
    if (![24, 48, 72, 168].includes(hours))
      return NextResponse.json({ error: "Ugyldig afbestillingsfrist" }, { status: 400 });
    const { error: cutoffError } = await createAdminClient()
      .from("bookable_shelters")
      .update({ cancellation_cutoff_hours: hours })
      .eq("id", shelter.id);
    if (cutoffError)
      return NextResponse.json({ error: cutoffError.message }, { status: 500 });
    if (!("shelter_price_dkk" in body) && !("ical_import_url" in body))
      return NextResponse.json({ ok: true });
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/owner/[token]/settings/route.ts"
git commit -m "feat: settings API handles cancellation_cutoff_hours"
```

---

## Task 9: Guest Booking Page

**Files:**
- Create: `web/app/(site)/min-booking/[guestToken]/page.tsx`
- Create: `web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx`

### Step 1: Create the server component (`page.tsx`)

- [ ] **Create `web/app/(site)/min-booking/[guestToken]/page.tsx`:**

```typescript
import { notFound } from "next/navigation";
import {
  getBookingByGuestToken,
  getBookableShelterByPk,
  isRefundEligible,
} from "@/lib/booking-db";
import { getPaymentByBookingId } from "@/lib/payment-db";
import { BookingPageClient } from "./BookingPageClient";

export const dynamic = "force-dynamic";

function todayInCopenhagen(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
  }).format(new Date());
}

export default async function MinBookingPage({
  params,
}: {
  params: Promise<{ guestToken: string }>;
}) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) notFound();

  const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
  if (!shelter) notFound();

  const payment = await getPaymentByBookingId(booking.id);

  // Can the guest cancel right now?
  const todayCph = todayInCopenhagen();
  const canCancel =
    booking.status === "confirmed" && booking.check_in > todayCph;

  // Refund info for the "confirmed" view
  let refundEligible = false;
  let refundDeadlineStr: string | null = null;
  if (canCancel && payment?.status === "paid") {
    refundEligible = isRefundEligible(
      booking.check_in,
      shelter.cancellation_cutoff_hours
    );
    if (refundEligible) {
      const deadlineMs =
        new Date(booking.check_in).getTime() -
        shelter.cancellation_cutoff_hours * 3_600_000;
      refundDeadlineStr = new Date(deadlineMs).toLocaleDateString("da-DK", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Copenhagen",
      });
    }
  }

  // Reconstruct refund status for the "cancelled" view
  let cancelledWithRefund = false;
  if (
    booking.status === "cancelled" &&
    booking.cancelled_at &&
    payment?.status === "paid"
  ) {
    cancelledWithRefund = isRefundEligible(
      booking.check_in,
      shelter.cancellation_cutoff_hours,
      new Date(booking.cancelled_at)
    );
  }

  return (
    <BookingPageClient
      booking={booking}
      shelter={shelter}
      canCancel={canCancel}
      refundEligible={refundEligible}
      refundDeadlineStr={refundDeadlineStr}
      cancelledWithRefund={cancelledWithRefund}
      hasPaidPayment={payment?.status === "paid"}
    />
  );
}
```

### Step 2: Create the client component (`BookingPageClient.tsx`)

- [ ] **Create `web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx`:**

```typescript
"use client";

import { useState } from "react";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

type ViewState = "details" | "confirming" | "loading" | "done" | "error";

interface Props {
  booking: ShelterBooking;
  shelter: BookableShelter;
  canCancel: boolean;
  refundEligible: boolean;
  refundDeadlineStr: string | null;
  cancelledWithRefund: boolean;
  hasPaidPayment: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function nights(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
  );
}

export function BookingPageClient({
  booking,
  shelter,
  canCancel,
  refundEligible,
  refundDeadlineStr,
  cancelledWithRefund,
  hasPaidPayment,
}: Props) {
  const [view, setView] = useState<ViewState>(
    booking.status === "cancelled" ? "done" : "details"
  );
  const [refunded, setRefunded] = useState(cancelledWithRefund);
  const [refundError, setRefundError] = useState(false);

  async function handleCancel() {
    setView("loading");
    try {
      const res = await fetch(
        `/api/booking/${booking.guest_token}/cancel`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setView("error");
        return;
      }
      setRefunded(data.refunded ?? false);
      setRefundError(data.refundError ?? false);
      setView("done");
    } catch {
      setView("error");
    }
  }

  const n = nights(booking.check_in, booking.check_out);

  return (
    <main className="min-h-screen bg-[#fafaf7] py-10 px-4">
      <div className="mx-auto max-w-md">

        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-primary/50 mb-0.5">{shelter.title}</p>
          <h1 className="font-serif text-2xl font-bold text-primary leading-tight">
            Din booking
          </h1>
        </div>

        {/* Status badge */}
        <div className="mb-5">
          {(booking.status === "confirmed" || view === "details" || view === "confirming" || view === "loading") && view !== "done" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm font-medium text-emerald-700">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Bekræftet
            </span>
          )}
          {booking.status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm font-medium text-amber-700">
              🕐 Afventer bekræftelse
            </span>
          )}
          {(booking.status === "cancelled" || view === "done") && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600">
              ✗ Annulleret
            </span>
          )}
          {booking.status === "rejected" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600">
              ✗ Afvist
            </span>
          )}
        </div>

        {/* Booking details card */}
        <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-5 mb-5">
          <dl className="space-y-3">
            {[
              { label: "Ankomst", value: fmtDate(booking.check_in) },
              { label: "Afrejse", value: fmtDate(booking.check_out) },
              {
                label: "Nætter",
                value: String(n),
              },
              {
                label: "Gæster",
                value: `${booking.guest_count} ${booking.guest_count === 1 ? "person" : "personer"}`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-baseline gap-4">
                <dt className="text-sm text-primary/55">{label}</dt>
                <dd className="text-sm font-medium text-primary text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Cancelled view ── */}
        {(booking.status === "cancelled" || view === "done") && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {booking.cancelled_at
                ? `Annulleret ${new Date(booking.cancelled_at).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}`
                : "Booking annulleret"}
            </p>
            {(refunded || (view === "done" && refunded)) ? (
              <p className="text-sm text-emerald-700">
                Du modtager fuld refund inden for 5-10 hverdage.
              </p>
            ) : hasPaidPayment ? (
              <p className="text-sm text-gray-500">
                Ingen refund iht. afbestillingspolitikken.
              </p>
            ) : null}
            {refundError && (
              <p className="text-sm text-amber-700 mt-2">
                Annullering gennemført, men refund fejlede. Kontakt ejeren på{" "}
                <a href={`mailto:${shelter.owner_email}`} className="underline">
                  {shelter.owner_email}
                </a>
                .
              </p>
            )}
          </div>
        )}

        {/* ── Details / can cancel ── */}
        {view === "details" && canCancel && (
          <div className="space-y-3">
            {/* Refund policy info */}
            {hasPaidPayment && (
              <div className="rounded-xl border border-primary/8 bg-white px-4 py-3 text-sm text-primary/70">
                {refundEligible ? (
                  <p>
                    Du kan annullere med fuld refund frem til{" "}
                    <strong>{refundDeadlineStr}</strong>.
                  </p>
                ) : (
                  <p>
                    Du er inden for afbestillingsfristen — der gives ingen refund.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setView("confirming")}
              className="w-full rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm font-medium text-primary/70 hover:border-primary/40 hover:text-primary transition-colors"
            >
              Annullér booking
            </button>
          </div>
        )}

        {/* ── Inline confirmation dialog ── */}
        {view === "confirming" && (
          <div className="rounded-2xl border border-primary/12 bg-white shadow-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-primary mb-1">Er du sikker?</p>
              <p className="text-sm text-primary/60">
                {fmtDate(booking.check_in)} – {fmtDate(booking.check_out)} ·{" "}
                {booking.guest_count} {booking.guest_count === 1 ? "person" : "personer"}
              </p>
            </div>
            <div className="rounded-xl bg-primary/[0.03] border border-primary/8 px-4 py-3 text-sm">
              {hasPaidPayment ? (
                refundEligible ? (
                  <p className="text-emerald-700 font-medium">
                    ✓ Du modtager fuld refund ved annullering.
                  </p>
                ) : (
                  <p className="text-primary/70">
                    Ingen refund — du er inden for afbestillingsfristen.
                  </p>
                )
              ) : (
                <p className="text-primary/70">
                  Der er ingen betaling at refundere.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Ja, annullér min booking
              </button>
              <button
                type="button"
                onClick={() => setView("details")}
                className="flex-1 rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-medium text-primary/70 hover:border-primary/40 transition-colors"
              >
                Fortryd
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {view === "loading" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-primary/50">
            <span className="w-4 h-4 border-2 border-primary/20 border-t-primary/60 rounded-full animate-spin" />
            Annullerer…
          </div>
        )}

        {/* ── Error ── */}
        {view === "error" && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Noget gik galt. Prøv igen eller kontakt os.
          </div>
        )}

      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Manual smoke test**

Start dev server: `cd web && npm run dev`

1. Find a confirmed booking in Supabase Dashboard, copy its `guest_token`
2. Open `http://localhost:3000/min-booking/[guest_token]`
3. Verify: booking details display correctly, cancel button visible for future bookings
4. Verify: `http://localhost:3000/min-booking/invalid-uuid-here` returns 404

- [ ] **Step 5: Commit**

```bash
git add "web/app/(site)/min-booking" 
git commit -m "feat: guest booking page at /min-booking/[guestToken]"
```

---

## Task 10: Owner Dashboard — Cancel UI + Policy Section

**Files:**
- Modify: `web/components/owner/OwnerDashboard.tsx`

### Step 1: State + handlers

- [ ] **Add new state variables** after the existing state declarations (around line 220):

```typescript
  // Cancel flow state
  const [cancellingId, setCancellingId] = useState<string | null>(null);  // which booking shows confirm panel
  const [cancelActingId, setCancelActingId] = useState<string | null>(null); // loading state
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Cancellation policy state
  const [cutoffHours, setCutoffHours] = useState<number>(
    shelter.cancellation_cutoff_hours ?? 48
  );
  const [savedCutoffHours, setSavedCutoffHours] = useState<number>(
    shelter.cancellation_cutoff_hours ?? 48
  );
  const [cutoffSaving, setCutoffSaving] = useState(false);
  const [cutoffMsg, setCutoffMsg] = useState<{ ok: boolean; text: string } | null>(null);
```

- [ ] **Add `handleOwnerCancel` and `handleCutoffSave` functions** after `handleResendPayment` (around line 498):

```typescript
  const handleOwnerCancel = async (bookingId: string) => {
    setCancelError(null);
    setCancelActingId(bookingId);
    const res = await fetch(`/api/owner/${ownerToken}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action: "cancel" }),
    });
    const data = await res.json();
    setCancelActingId(null);
    setCancellingId(null);
    if (!res.ok) {
      setCancelError(data.error ?? "Fejl ved annullering");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: "cancelled" as const }
          : b
      )
    );
  };

  const handleCutoffSave = async () => {
    setCutoffSaving(true);
    setCutoffMsg(null);
    const res = await fetch(`/api/owner/${ownerToken}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancellation_cutoff_hours: cutoffHours }),
    });
    setCutoffSaving(false);
    if (res.ok) {
      setSavedCutoffHours(cutoffHours);
      setCutoffMsg({ ok: true, text: "✓ Gemt" });
      setTimeout(() => setCutoffMsg(null), 3000);
    } else {
      setCutoffMsg({ ok: false, text: "Fejl — prøv igen" });
    }
  };
```

### Step 2: Add cancel button to "Kommende bookinger" cards

- [ ] **Find the upcoming booking card rendering** (around line 792) and add the cancel button + inline panel after the existing badges in the `<div className="flex items-center gap-2 ...">` section.

Add at the end of the badges section, still inside the booking card:

```tsx
                    {/* Cancel button — discrete text link */}
                    {b.check_in > todayIso && (
                      cancellingId === b.id ? (
                        // Inline confirmation panel
                        <div className="w-full mt-2 rounded-xl border border-primary/10 bg-primary/[0.02] p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-primary">Er du sikker?</p>
                            <p className="text-xs text-primary/50 mt-0.5">
                              {b.guest_name} · {fmt(b.check_in)}–{fmt(b.check_out)} · {b.guest_count} pers.
                            </p>
                          </div>
                          <p className="text-xs text-primary/60">
                            Gæsten vil modtage besked og fuld refund (hvis betaling er gennemført).
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOwnerCancel(b.id)}
                              disabled={cancelActingId === b.id}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
                            >
                              {cancelActingId === b.id ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Annullerer…
                                </span>
                              ) : "Ja, annullér"}
                            </button>
                            <button
                              onClick={() => setCancellingId(null)}
                              disabled={cancelActingId === b.id}
                              className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-medium text-primary/60 hover:border-primary/30 disabled:opacity-40 transition-colors"
                            >
                              Fortryd
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setCancellingId(b.id); setCancelError(null); }}
                          className="text-xs text-primary/40 hover:text-primary/70 font-medium transition-colors"
                        >
                          Annullér
                        </button>
                      )
                    )}
```

Place the cancel error display below the bookings list (after the `upcoming.map` closing tag):

```tsx
            {cancelError && (
              <p className="mt-2 text-xs text-red-600">{cancelError}</p>
            )}
```

### Step 3: Update `const all` filter and show cancelled bookings

- [ ] **Update the `all` filter** (line ~259) to keep cancelled in a separate list:

After `const upcoming = ...` and `const all = ...`, add:

```typescript
  const cancelled = bookings.filter((b) => b.status === "cancelled");
```

- [ ] **Add "Annullerede bookinger" section** after the "Kommende bookinger" section (after line ~849), only if there are cancelled bookings:

```tsx
      {/* ── Annullerede bookinger ── */}
      {cancelled.length > 0 && (
        <section className="rounded-2xl border border-primary/8 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/6">
            <h2 className="font-serif text-lg font-bold text-primary">Annullerede bookinger</h2>
          </div>
          <div className="p-4 space-y-2">
            {cancelled.map((b) => (
              <div key={b.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary/60 text-sm">{b.guest_name}</p>
                  <p className="text-xs text-primary/40">{fmt(b.check_in)} → {fmt(b.check_out)} · {b.guest_count} pers.</p>
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full shrink-0">
                  {b.cancelled_by === "owner" ? "Annulleret af dig" : "Annulleret af gæst"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
```

### Step 4: Add "Afbestillingsregler" section

- [ ] **Add the policy section** after the "Priser" section and before "Automatiske beskeder" (around line 1020):

```tsx
      {/* ── Afbestillingsregler ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
        <h2 className="font-serif text-lg font-bold text-primary mb-1">Afbestillingsregler</h2>
        <p className="text-xs text-primary/40 mb-4">
          Gæster kan annullere op til check-in. Vælg hvor lang tid før ankomst de får fuld refund.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
              Fuld refund frem til
            </label>
            <select
              value={cutoffHours}
              onChange={(e) => setCutoffHours(Number(e.target.value))}
              className="rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all bg-white"
            >
              <option value={24}>24 timer før ankomst</option>
              <option value={48}>48 timer før ankomst</option>
              <option value={72}>72 timer før ankomst</option>
              <option value={168}>7 dage før ankomst</option>
            </select>
          </div>
          <button
            onClick={handleCutoffSave}
            disabled={cutoffSaving || cutoffHours === savedCutoffHours}
            className="rounded-xl bg-primary text-white px-5 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {cutoffSaving ? "Gemmer…" : "Gem"}
          </button>
          {cutoffMsg && (
            <span className={`text-xs font-medium ${cutoffMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
              {cutoffMsg.text}
            </span>
          )}
        </div>
      </section>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Run full test suite**

```bash
cd web && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 7: Manual smoke test**

Start dev server: `cd web && npm run dev`

1. Open an owner dashboard with at least one confirmed upcoming booking
2. Verify: "Annullér" text button appears next to the booking
3. Click "Annullér" → confirm panel opens inline (no modal)
4. Click "Fortryd" → panel closes
5. Verify "Afbestillingsregler" section appears below "Priser" with dropdown
6. Change dropdown value → "Gem" button becomes active → save → "✓ Gemt" shows

- [ ] **Step 8: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat: owner dashboard cancel UI and cancellation policy section"
```

---

## Task 11: Final Integration Test + Clean Up

- [ ] **Step 1: Run full test suite one last time**

```bash
cd web && npx vitest run
```
Expected: All tests pass with no failures.

- [ ] **Step 2: TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: End-to-end smoke test (manual)**

Using dev server:

1. **Guest cancel with refund:**
   - Find a confirmed booking with check_in > 48h from now and a paid payment
   - Open `/min-booking/[guestToken]` — verify "Bekræftet" badge, dates visible, "Du kan annullere med fuld refund frem til…" shown
   - Click "Annullér booking" → confirmation dialog shows "Du modtager fuld refund"
   - Click "Ja, annullér min booking" → loading spinner → "Annulleret" badge, refund text

2. **Guest cancel without refund:**
   - Find a confirmed booking with check_in < 48h from now
   - Open `/min-booking/[guestToken]` — verify "Du er inden for afbestillingsfristen" shown
   - Cancel → "Ingen refund" in confirmation dialog

3. **Owner cancel:**
   - In dashboard, click "Annullér" on an upcoming booking
   - Inline confirm panel shows → click "Ja, annullér" → booking shows "Annulleret af dig" in cancelled section

4. **Invalid token:**
   - Open `/min-booking/00000000-0000-0000-0000-000000000000` → 404 page

- [ ] **Step 4: Push to production**

```bash
git push origin main
```

Apply SQL migration in production Supabase if not already done (same SQL as Task 1).
