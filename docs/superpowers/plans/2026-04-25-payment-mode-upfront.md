# Payment Mode (Upfront vs After Confirmation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `payment_mode` setting to `bookable_shelters` so shelter owners can choose between paying *after confirmation* (current default: owner accepts → guest pays) or *upfront* (guest pays immediately → owner confirms or refunds).

**Architecture:** Add a `payment_mode` column (`after_confirmation` | `upfront`) to `bookable_shelters`. For upfront shelters, the booking API creates a Stripe checkout session at booking time and returns a `checkoutUrl`; the `BookingForm` redirects there. Owner reject on an upfront booking calls `stripe.refunds.create()`. The webhook skips the "booking confirmed" email for upfront bookings (owner hasn't confirmed yet).

**Tech Stack:** Next.js 15, Supabase (Postgres), Stripe v22, Resend, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `migrations/036_add_payment_mode.sql` | **CREATE** — add `payment_mode` column |
| `web/types/booking.ts` | **MODIFY** — add `payment_mode` to `BookableShelter` |
| `web/app/api/admin/shelters/route.ts` | **MODIFY** — accept `payment_mode` in POST |
| `web/app/(site)/admin/shelters/page.tsx` | **MODIFY** — add `payment_mode` select to create form |
| `web/app/api/book/[slug]/route.ts` | **MODIFY** — for upfront: create Stripe session + return `checkoutUrl` |
| `web/app/(site)/book/[slug]/page.tsx` | **MODIFY** — pass `paymentMode` + price props to `BookingForm` |
| `web/components/booking/BookingForm.tsx` | **MODIFY** — show price for upfront, redirect to `checkoutUrl` |
| `web/lib/booking-email.ts` | **MODIFY** — add `sendUpfrontPaymentReceived` + `sendRefundedToGuest` |
| `web/app/api/stripe/webhook/route.ts` | **MODIFY** — for upfront payment: notify owner instead of confirming |
| `web/app/api/owner/[token]/action/route.ts` | **MODIFY** — confirm skips payment for upfront; reject creates refund |
| `web/components/owner/OwnerDashboard.tsx` | **MODIFY** — show "Forudbetalt" badge for upfront + paid bookings |

---

## Task 1: DB Migration

**File:** Create `migrations/036_add_payment_mode.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 036_add_payment_mode.sql
ALTER TABLE bookable_shelters
  ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'after_confirmation'
  CHECK (payment_mode IN ('after_confirmation', 'upfront'));

COMMENT ON COLUMN bookable_shelters.payment_mode IS
  'after_confirmation: guest requests, owner confirms, then guest pays. upfront: guest pays immediately, owner confirms or refunds.';
```

- [ ] **Step 2: Note for user**

This migration must be run in Supabase SQL editor. Existing shelters get `after_confirmation` (no behaviour change).

- [ ] **Step 3: Commit**

```bash
git add migrations/036_add_payment_mode.sql
git commit -m "feat: add payment_mode column to bookable_shelters"
```

---

## Task 2: Type Update

**File:** Modify `web/types/booking.ts`

- [ ] **Step 1: Add `payment_mode` to `BookableShelter` interface**

In `web/types/booking.ts`, add after the `platform_fee_min_dkk` line:

```typescript
  payment_mode: "after_confirmation" | "upfront";
```

Full interface becomes:
```typescript
export interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shelter_id: string | null;
  owner_email: string;
  owner_token: string;
  max_persons: number;
  booking_mode: "shelterdk" | "iframe";
  ical_import_url: string | null;
  ical_last_synced_at: string | null;
  shelter_price_dkk: number | null;
  platform_fee_pct: number;
  platform_fee_min_dkk: number;
  payment_mode: "after_confirmation" | "upfront";
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/types/booking.ts
git commit -m "feat: add payment_mode to BookableShelter type"
```

---

## Task 3: Admin API — Accept `payment_mode`

**File:** Modify `web/app/api/admin/shelters/route.ts`

- [ ] **Step 1: Destructure `payment_mode` from body and include in insert**

In the POST handler, change:
```typescript
const { slug, title, owner_email, max_persons, description, shelter_id, booking_mode } = body;
```
to:
```typescript
const { slug, title, owner_email, max_persons, description, shelter_id, booking_mode, payment_mode } = body;
```

And in the `.insert({...})` call, add:
```typescript
payment_mode: payment_mode === "upfront" ? "upfront" : "after_confirmation",
```

Full insert object:
```typescript
.insert({
  slug: slug.trim().toLowerCase(),
  title: title.trim(),
  owner_email: owner_email.trim().toLowerCase(),
  max_persons: Number(max_persons) || 6,
  description: description?.trim() || null,
  shelter_id: shelter_id || null,
  booking_mode: booking_mode === "shelterdk" ? "shelterdk" : "iframe",
  payment_mode: payment_mode === "upfront" ? "upfront" : "after_confirmation",
})
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/admin/shelters/route.ts
git commit -m "feat: admin shelters API accepts payment_mode"
```

---

## Task 4: Admin UI — `payment_mode` Select Dropdown

**File:** Modify `web/app/(site)/admin/shelters/page.tsx`

- [ ] **Step 1: Add `payment_mode` to form state**

Change initial form state from:
```typescript
const [form, setForm] = useState({
  slug: "", title: "", owner_email: "", max_persons: "6", description: "",
});
```
to:
```typescript
const [form, setForm] = useState({
  slug: "", title: "", owner_email: "", max_persons: "6", description: "", payment_mode: "after_confirmation",
});
```

- [ ] **Step 2: Add select field to the create form**

Add this `<div>` inside the `<form>` grid, after the `max_persons` field:
```tsx
<div>
  <label className="block text-sm font-medium text-primary mb-1">
    Betalingsmodel
  </label>
  <select
    value={form.payment_mode}
    onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
  >
    <option value="after_confirmation">Betal efter accept (standard)</option>
    <option value="upfront">Betal ved booking (forudbetaling)</option>
  </select>
</div>
```

- [ ] **Step 3: Reset `payment_mode` on successful create**

In `handleCreate`, after `setForm({ slug: "", ...})`, ensure `payment_mode` resets:
```typescript
setForm({ slug: "", title: "", owner_email: "", max_persons: "6", description: "", payment_mode: "after_confirmation" });
```

- [ ] **Step 4: Commit**

```bash
git add web/app/(site)/admin/shelters/page.tsx
git commit -m "feat: admin shelter form — payment_mode select dropdown"
```

---

## Task 5: Booking API Route — Upfront Creates Stripe Session

**File:** Modify `web/app/api/book/[slug]/route.ts`

The current route creates a booking and sends emails. For `upfront` shelters, it must additionally create a Stripe checkout session, store it in `booking_payments`, and return a `checkoutUrl`.

- [ ] **Step 1: Add imports**

Add at the top of the file:
```typescript
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment } from "@/lib/payment-db";
```

- [ ] **Step 2: Replace the return statement after a successful booking**

Replace:
```typescript
return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 201 });
```

with:
```typescript
// For upfront shelters: create Stripe checkout session immediately
let checkoutUrl: string | undefined;
if (shelter.payment_mode === "upfront") {
  try {
    const { url, sessionId } = await createCheckoutSession(booking, shelter);
    const { shelterDkk, platformDkk, totalDkk } = calculateFee(
      shelter.shelter_price_dkk ?? 0,
      shelter.platform_fee_pct,
      shelter.platform_fee_min_dkk
    );
    await createBookingPayment({
      bookingId: booking.id,
      stripeCheckoutSessionId: sessionId,
      amountTotalDkk: totalDkk,
      amountShelterDkk: shelterDkk,
      amountPlatformDkk: platformDkk,
    });
    checkoutUrl = url;
  } catch (err) {
    console.error("book route: upfront checkout error:", err);
    // Non-fatal: booking is created; guest will need to contact support
  }
}

return NextResponse.json(
  { ok: true, bookingId: booking.id, checkoutUrl },
  { status: 201 }
);
```

Note: The full `try/catch` block for booking creation already wraps this code, so the new Stripe call goes inside the existing `try` block, before the final `return`.

- [ ] **Step 3: Verify TypeScript compiles — run from web/**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking/web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to these files.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/book/[slug]/route.ts
git commit -m "feat: booking API creates Stripe session upfront for upfront payment_mode"
```

---

## Task 6: Book Page — Pass Payment Mode to BookingForm

**File:** Modify `web/app/(site)/book/[slug]/page.tsx`

- [ ] **Step 1: Pass `paymentMode` and price props to `BookingForm`**

Change `BookingForm` usage:
```tsx
<BookingForm
  shelterSlug={shelter.slug}
  shelterTitle={shelter.title}
  maxPersons={shelter.max_persons}
  description={shelter.description}
  successPath={`/book/${shelter.slug}/tak`}
  paymentMode={shelter.payment_mode}
  shelterPriceDkk={shelter.shelter_price_dkk ?? 0}
  platformFeePct={shelter.platform_fee_pct}
  platformFeeMinDkk={shelter.platform_fee_min_dkk}
/>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/(site)/book/[slug]/page.tsx
git commit -m "feat: pass paymentMode and price props to BookingForm"
```

---

## Task 7: BookingForm — Show Price + Redirect to Stripe for Upfront

**File:** Modify `web/components/booking/BookingForm.tsx`

Two changes:
1. Accept new props, show a price breakdown in the summary card for upfront shelters
2. After submit, if response contains `checkoutUrl`, redirect there instead of `successPath`

- [ ] **Step 1: Update props interface**

Replace:
```typescript
interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
  description?: string | null;
  successPath?: string;
}
```

with:
```typescript
interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
  description?: string | null;
  successPath?: string;
  paymentMode?: "after_confirmation" | "upfront";
  shelterPriceDkk?: number;
  platformFeePct?: number;
  platformFeeMinDkk?: number;
}
```

- [ ] **Step 2: Destructure new props and calculate fee**

In the function signature, destructure:
```typescript
export function BookingForm({
  shelterSlug, shelterTitle, maxPersons, description, successPath,
  paymentMode = "after_confirmation", shelterPriceDkk = 0,
  platformFeePct = 5, platformFeeMinDkk = 25,
}: BookingFormProps) {
```

Add fee calculation near the top of the function body (after `nights` calculation):
```typescript
const isUpfront = paymentMode === "upfront";
const platformFee = Math.max(Math.round(shelterPriceDkk * platformFeePct / 100), platformFeeMinDkk);
const totalDkk = shelterPriceDkk + platformFee;
```

- [ ] **Step 3: Handle `checkoutUrl` in submit handler**

In `handleSubmit`, replace the redirect logic:
```typescript
const data = await res.json();
if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
if (data.checkoutUrl) {
  window.location.href = data.checkoutUrl;
} else {
  router.push(successPath ?? `/embed/book/${shelterSlug}/tak`);
}
```

- [ ] **Step 4: Show price breakdown in the summary card for upfront**

In the date summary card (the `{dateRange ? (...)` block), after the duration row, add:
```tsx
{isUpfront && shelterPriceDkk > 0 && (
  <div className="border-t border-accent/10 px-4 py-3 space-y-1.5">
    <div className="flex justify-between text-xs text-primary/60">
      <span>Overnatning</span>
      <span>{shelterPriceDkk} kr</span>
    </div>
    <div className="flex justify-between text-xs text-primary/60">
      <span>Administrationsgebyr</span>
      <span>{platformFee} kr</span>
    </div>
    <div className="flex justify-between text-xs font-bold text-primary border-t border-primary/10 pt-1.5">
      <span>I alt</span>
      <span>{totalDkk} kr</span>
    </div>
  </div>
)}
```

- [ ] **Step 5: Update trust signals and CTA for upfront**

Update trust signals array to be conditional:
```typescript
const trustSignals = isUpfront
  ? ["Sikker betaling via MobilePay eller kort", "Du betaler nu og ejeren bekræfter herefter", "Fuld refundering ved afvisning"]
  : ["Gratis at sende en forespørgsel", "Du betaler ingenting nu", "Ejer svarer typisk inden 24 timer"];
```

Replace hardcoded trust signals arrays (there are two — desktop and mobile) with `{trustSignals.map(...)}`.

Update the CTA text:
```tsx
{submitting ? (
  <span className="flex items-center justify-center gap-2">
    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    Sender…
  </span>
) : dateRange ? (
  isUpfront ? `Gå til betaling — ${totalDkk} kr` : "Send bookingforespørgsel"
) : (
  "Vælg datoer for at fortsætte"
)}
```

Update the micro-copy below the button:
```tsx
<p className="text-[11px] text-primary/30 text-center leading-relaxed">
  {isUpfront ? `Sikker betaling · fuld refundering ved afvisning` : "Gratis · uforpligtende · ingen betaling nu"}
</p>
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking/web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/components/booking/BookingForm.tsx
git commit -m "feat: BookingForm shows price and redirects to Stripe for upfront payment mode"
```

---

## Task 8: Email — Add Upfront Emails

**File:** Modify `web/lib/booking-email.ts`

Two new email functions needed:
1. `sendUpfrontPaymentReceived` — sent by webhook when upfront payment succeeds (owner not yet confirmed)
2. `sendRefundedToGuest` — sent when owner rejects an upfront paid booking

- [ ] **Step 1: Add `sendUpfrontPaymentReceived`**

After `sendBookingExpired`, add:
```typescript
/** Til ejeren: ny forudbetalt booking afventer din bekræftelse */
export async function sendUpfrontPaymentReceived(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Forudbetalt booking til ${esc(opts.shelterTitle)} — afventer din bekræftelse`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny forudbetalt booking</h2>
        <p><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) har forudbetalt <strong>${opts.amountTotalDkk} kr</strong> for <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <p>Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.</p>
        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Gå til dit dashboard</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (forudbetaling ejer): " + JSON.stringify(error));
}
```

- [ ] **Step 2: Add `sendRefundedToGuest`**

```typescript
/** Til gæsten: booking afvist, betaling refunderes */
export async function sendRefundedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er afvist — refundering på vej`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}</h2>
        <p>Desværre kunne ejeren ikke imødekomme din forudbetaling til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p>Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5-10 hverdage.</p>
        <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (refundering gæst): " + JSON.stringify(error));
}
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/booking-email.ts
git commit -m "feat: add sendUpfrontPaymentReceived and sendRefundedToGuest email functions"
```

---

## Task 9: Webhook — Handle Upfront Payment

**File:** Modify `web/app/api/stripe/webhook/route.ts`

For `after_confirmation`: current behaviour (mark paid + send `sendPaymentConfirmed`).
For `upfront`: mark paid + notify owner to confirm/reject (via `sendUpfrontPaymentReceived`).

- [ ] **Step 1: Add new imports**

```typescript
import { sendPaymentConfirmed, sendUpfrontPaymentReceived } from "@/lib/booking-email";
```
(replace existing `sendPaymentConfirmed` import)

- [ ] **Step 2: Update webhook handler to branch on `payment_mode`**

Replace the email section in `checkout.session.completed`:

```typescript
// Send confirmation emails (non-critical — don't fail the webhook)
try {
  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("guest_email, guest_name, check_in, check_out, bookable_shelters!inner(owner_email, owner_token, title, payment_mode)")
    .eq("id", payment.booking_id)
    .single();

  if (booking) {
    const shelter = (booking as any).bookable_shelters;
    if (shelter.payment_mode === "upfront") {
      // Booking is still pending — notify owner to confirm
      await sendUpfrontPaymentReceived({
        ownerEmail: shelter.owner_email,
        shelterTitle: shelter.title,
        ownerToken: shelter.owner_token,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: payment.amount_total_dkk,
      });
    } else {
      // after_confirmation: payment means booking is fully confirmed
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
  }
} catch (err) {
  console.error("Webhook: confirmation email failed (non-fatal):", err);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/stripe/webhook/route.ts
git commit -m "feat: webhook branches email on payment_mode — upfront notifies owner, after_confirmation confirms booking"
```

---

## Task 10: Owner Action Route — Upfront Confirm + Reject with Refund

**File:** Modify `web/app/api/owner/[token]/action/route.ts`

**Confirm for upfront:** Payment already exists and is paid. Just mark booking confirmed + send "booking confirmed" email (no Stripe session).

**Reject for upfront + paid:** Create Stripe refund, reject booking, send refund email.

- [ ] **Step 1: Add Stripe + new email imports**

Add:
```typescript
import Stripe from "stripe";
import { sendBookingConfirmedToGuest, sendRefundedToGuest } from "@/lib/booking-email";
```

- [ ] **Step 2: Update `confirm` action**

Replace the entire `if (action === "confirm")` block with:

```typescript
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

  if (shelter.payment_mode === "upfront") {
    // Payment already captured — just send confirmation email
    try {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
      });
    } catch (err) {
      console.error("owner confirm (upfront): confirmation email error:", err);
    }
  } else {
    // after_confirmation: create Stripe session + send payment request
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
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update `reject` action**

Replace the entire `if (action === "reject")` block with:

```typescript
if (action === "reject") {
  if (booking.status !== "pending")
    return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

  await updateBookingStatus(bookingId, "rejected");

  // For upfront shelters with a paid payment: issue Stripe refund
  const payment = await getPaymentByBookingId(bookingId);
  if (shelter.payment_mode === "upfront" && payment?.status === "paid") {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id,
        { expand: ["payment_intent"] }
      );
      const pi = session.payment_intent as Stripe.PaymentIntent;
      if (pi?.id) {
        await stripe.refunds.create({ payment_intent: pi.id });
      }
    } catch (err) {
      console.error("owner reject: Stripe refund error:", err);
      // Non-fatal — admin can issue refund manually in Stripe dashboard
    }
    try {
      await sendRefundedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        amountTotalDkk: payment.amount_total_dkk,
      });
    } catch (err) {
      console.error("owner reject: refund email error:", err);
    }
  } else {
    // Standard rejection email (no refund)
    try {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    } catch (err) {
      console.error("owner reject email error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking/web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/owner/[token]/action/route.ts
git commit -m "feat: owner action route — upfront confirm skips payment, reject issues Stripe refund"
```

---

## Task 11: Owner Dashboard — Upfront Badge

**File:** Modify `web/components/owner/OwnerDashboard.tsx`

Show a "Forudbetalt" badge for upfront + paid pending bookings (awaiting owner decision).

- [ ] **Step 1: Add `isUpfront` constant near the top of `OwnerDashboard`**

Since `OwnerDashboard` uses the owner token to fetch a single shelter, the `shelter` object is already available in state. Add this derived constant after `shelter` is populated:

```tsx
const isUpfront = shelter?.payment_mode === "upfront";
```

(Place this alongside other derived values, e.g. near `pricePerNight` state.)

- [ ] **Step 2: Update the payment badge rendering in the upcoming bookings map**

Find the section inside the bookings `.map((b) => (...))` that renders payment badges. Replace the "Betalt ✓" badge with a conditional variant:

```tsx
{p?.status === "paid" && (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
    {isUpfront && b.status === "pending"
      ? "⚡ Forudbetalt — afventer din godkendelse"
      : "Betalt ✓"}
  </span>
)}
```

For `after_confirmation` pending unpaid: keep showing existing "Afventer betaling" badge (no change needed there).
For `upfront` pending paid: shows "⚡ Forudbetalt — afventer din godkendelse".

- [ ] **Step 2: Check that `shelter` type includes `payment_mode`**

The `OwnerDashboard` fetches the shelter via the owner token API. Since we updated `BookableShelter` in `types/booking.ts`, TypeScript will enforce this. The fetch response should already include `payment_mode` from the DB after running the migration.

- [ ] **Step 3: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat: owner dashboard shows Forudbetalt badge for upfront pending bookings"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking/web && npx vitest run 2>&1 | tail -20
```
Expected: all tests passing (should be same as before since no existing payment tests).

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking/web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Manual checklist (after deploying)**

After deploying and running the migration in Supabase:

1. Go to `/admin/shelters?secret=XXX` → create a new shelter with "Betal ved booking" → verify shelter is saved with `payment_mode = 'upfront'`
2. Go to `/book/[upfront-slug]` → verify price breakdown shows in summary card, CTA says "Gå til betaling — X kr"
3. Submit the form → verify you're redirected to Stripe checkout
4. Complete payment in test mode → verify you land on `/booking/[id]/tak`
5. Check owner dashboard → verify "Forudbetalt" badge on booking
6. Click "Acceptér" → verify guest gets "booking bekræftet" email (no payment link)
7. Click "Afvis" on a paid upfront booking → verify Stripe refund is created, guest gets refund email

- [ ] **Step 4: Push to feature branch and create PR**

```bash
cd /Users/CKA/shelterdk/.worktrees/feature-booking
git push origin feature/shelter-booking-mvp
```

---

## Key Design Decisions

**Why not auto-confirm when upfront payment succeeds?**
Owner may still need to check availability conflicts or other reasons. Keeping manual confirmation preserves owner control and is simpler to reason about.

**Why is `payment_mode` on the shelter, not the booking?**
A shelter's payment model is a policy, not per-booking. All bookings for a shelter follow the same model.

**What happens if Stripe refund fails?**
The booking is already marked `rejected` (non-reversible from guest's side). The refund error is logged as non-fatal. Admin can issue the refund manually in the Stripe dashboard. Acceptable for MVP.

**What about the `betal/[id]` page for upfront bookings?**
Since payment happens before confirmation, upfront bookings' `betal` page should never be visited in the normal flow. If a guest navigates there manually, the existing "Booking afventer bekræftelse fra ejeren" or "Betaling gennemført" message handles it gracefully.
