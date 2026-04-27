# Booking Cancellation Flow — Design

**Dato:** 2026-04-27
**Status:** Godkendt af bruger

---

## Mål

Giv både ejere og gæster mulighed for at annullere bekræftede bookinger med automatisk Stripe-refund og email-notifikationer. Gæsten får en permanent "Min booking"-side (foundation for fremtidige features som besked-system). Ejeren kan sætte en afbestillingspolitik pr. shelter.

---

## Arkitektur

### Stack
- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres)
- Resend (email)
- Stripe (refunds)

### Komponenter

```
supabase/migrations/20260427_booking_cancellation.sql
app/(site)/min-booking/[guestToken]/page.tsx    ← ny gæsteside
app/api/booking/[guestToken]/cancel/route.ts    ← gæst annullerer
app/api/owner/[token]/action/route.ts           ← udvides med "cancel"
app/api/owner/[token]/settings/route.ts         ← udvides med cancellation_cutoff_hours
lib/booking-email.ts                            ← +3 cancel-emails, opdater +2 med link
lib/booking-db.ts                               ← +getBookingByGuestToken + cancelBooking helpers
types/booking.ts                                ← opdateres med nye felter
components/owner/OwnerDashboard.tsx             ← cancel-knap + policy-sektion
```

**Rute-valg:** Gæstesiden placeres under `/min-booking/[guestToken]` (ikke `/booking/[guestToken]`), fordi `app/(site)/booking/[id]/` allerede eksisterer med `/betal` og `/tak` under-sider. To dynamiske segmenter på samme niveau er en Next.js build-fejl. Stripe-URLs i `lib/stripe.ts` bruger fortsat `booking.id` (ikke guest_token) — de er uberørte.

---

## Database

### Ændringer på `shelter_bookings`

```sql
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS guest_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('owner', 'guest', 'system'));
-- Note: 'system' er reserveret til fremtidig automatisk annullering (fx ved udløb).
-- Note: I PostgreSQL 12+ backfilles NOT NULL DEFAULT inline ved ALTER TABLE,
-- så eksisterende rækker får straks et unikt guest_token. Ingen manuel UPDATE nødvendig.

CREATE UNIQUE INDEX IF NOT EXISTS shelter_bookings_guest_token_unique
  ON shelter_bookings (guest_token);
```

**Status-constraint:** `shelter_bookings.status` har allerede `'cancelled'` i sin CHECK-constraint (se `20260424_booking_tables.sql`). Ingen ændring nødvendig.

### Ændringer på `bookable_shelters`

```sql
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INT NOT NULL DEFAULT 48;
```

Semantik: gæster modtager fuld refund hvis de annullerer mere end `cancellation_cutoff_hours` timer før `check_in`. Annullering tættere på check-in = ingen refund. Annullering er tilladt indtil — men ikke på — check-in dagen (dato-sammenligning: `check_in > today`). Fx: check_in 23. maj → annullering mulig til og med 22. maj.

---

## Types

Opdater `types/booking.ts`:

```typescript
// BookableShelter — tilføj:
cancellation_cutoff_hours: number; // default 48

// ShelterBooking — tilføj:
guest_token: string;
cancelled_at: string | null;
cancelled_by: "owner" | "guest" | "system" | null;
```

`BookingStatus` i `types/booking.ts` indeholder allerede `"cancelled"` — ingen ændring nødvendig.

`BookingPayment` i `types/booking.ts` + `lib/payment-db.ts` bruges til refund-opslag. Relevante felter:
- `status: "pending" | "paid" | "expired"`
- `stripe_checkout_session_id: string`
- `amount_total_dkk: number`

Helper: `getPaymentByBookingId(bookingId)` fra `lib/payment-db.ts` — returnerer seneste `BookingPayment | null`.

---

## Gæsteside — `/min-booking/[guestToken]`

Server-renderet App Router-side. `guestToken` er autentifikationen — ingen login.

### Layout og UX

Siden er designet til at være rolig, klar og tryg. Tone: neutral og venlig, ikke robotagtig.

```
┌────────────────────────────────────────┐
│  🏕 [Shelternavn]                       │
│  Din booking                           │
│                                        │
│  ┌── Status-badge ───────────────────┐ │
│  │  ✓ Bekræftet                      │ │
│  └───────────────────────────────────┘ │
│                                        │
│  Ankomst    fre. 23. maj               │
│  Afrejse    søn. 25. maj               │
│  Nætter     2                          │
│  Gæster     3 personer                 │
│                                        │
│  ─────────────────────────────────── │ │
│                                        │
│  [Knap: Annullér booking]              │
│  Afbestillingspolitik:                 │
│  Fuld refund ved annullering           │
│  mere end 48 timer før ankomst         │
└────────────────────────────────────────┘
```

### Status-varianter

| Status | Badge | Vises cancel-knap? |
|--------|-------|---------------------|
| `pending` | 🕐 Afventer bekræftelse | Nej |
| `confirmed` | ✓ Bekræftet (grøn) | Ja, hvis check_in > i dag |
| `cancelled` | ✗ Annulleret (grå) | Nej — viser hvornår + refund-info |
| `rejected` | ✗ Afvist | Nej |

### Refund-information (under cancel-knappen)

Vises kun ved `confirmed` og kun ved upfront-betalte bookinger:

- Hvis > cutoff: `"Du kan annullere med fuld refund frem til [dato/tidspunkt]"`
- Hvis < cutoff: `"Du er inden for afbestillingsfristen — der gives ingen refund"`
- `after_confirmation` + ubetalt: ingen refund-besked (ingen penge at refundere)

### Annulleringsflow (UX)

1. Gæsten klikker "Annullér booking"
2. Siden viser en bekræftelsesdialog **inline** (ikke browser confirm()):
   - Bookingdetaljer gentages
   - Refund-status tydeligt: "Du modtager fuld refund" / "Ingen refund"
   - To knapper: **"Ja, annullér min booking"** og **"Fortryd"**
3. Loading state mens API-kald kører
4. Siden opdateres til `cancelled`-view med: "Din booking er annulleret. [Refund-tekst]"

### Fejl-tilstande

- Ugyldig token → "Vi kunne ikke finde din booking."
- Allerede annulleret → viser annulleringsstatus
- Check-in fortid → "Det er ikke muligt at annullere en booking der allerede er startet."
- Stripe-fejl → "Annullering gennemført, men refund fejlede. Kontakt ejeren på [shelter.owner_email]." — `owner_email` er tilgængeligt fra shelter-data server-renderet med siden og sendes til klient-komponenten som prop.

---

## API

### `POST /api/booking/[guestToken]/cancel`

**Fejlresponse-shapes:**
- Ugyldig token / booking ikke fundet → `404 { error: "Booking ikke fundet" }`
- Status ikke confirmed → `409 { error: "Booking er ikke bekræftet" }`
- Check_in er i dag eller fortid → `400 { error: "Annullering er ikke mulig" }`
- Stripe-fejl (non-fatal) → `200 { ok: true, refunded: false, refundError: true }`
- Fuld success response shape: `{ ok: true, refunded: boolean, refundError?: true }`



**Auth:** Ingen header-auth — `guestToken` er hemmeligheden.

**Flow:**
1. Hent booking via `guest_token` (brug `getBookingByGuestToken` fra `lib/booking-db.ts`)
2. Valider: `booking.status === 'confirmed'`, `booking.check_in > today` (dato-sammenligning i Europe/Copenhagen tidszone; check_in = today → ikke tilladt)
3. Hent shelter via `booking.bookable_shelter_id` (for `cancellation_cutoff_hours`)
4. Hent payment via `getPaymentByBookingId(booking.id)` fra `lib/payment-db.ts`
5. Beregn refund-berettigelse:
   ```
   hoursUntilCheckIn = (new Date(booking.check_in) - now) / 3600_000
   fullRefund = hoursUntilCheckIn > shelter.cancellation_cutoff_hours
   ```
6. Hvis `payment?.status === 'paid'` AND `fullRefund` → Stripe refund (uanset payment_mode):
   ```typescript
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
   const session = await stripe.checkout.sessions.retrieve(
     payment.stripe_checkout_session_id,
     { expand: ["payment_intent"] }
   );
   const pi = session.payment_intent as { id?: string };
   if (pi.id) await stripe.refunds.create({ payment_intent: pi.id });
   ```
7. Opdater booking: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'guest'`
8. Send email til gæst (bekræftelse + refund-info)
9. Send email til ejer (notifikation)
10. Return `{ ok: true, refunded: boolean }`

**Sikkerhed:** `guestToken` er et UUID i URL'en — det er hemmeligheden. Ingen yderligere auth. Dette er et bevidst valg; linket har samme sikkerhedsniveau som et password-reset-link. Rate limiting via Netlify/Vercel edge (standard).

**Fejlhåndtering:** Stripe-fejl stopper IKKE annulleringen. Booking markeres cancelled og der logges. Response indeholder `refundError: true` så siden kan vise passende besked.

---

### `POST /api/owner/[token]/action` — udvidelse med `"cancel"`

**Ny action:** `action: "cancel"`

**Flow:**
1. Valider: `booking.status === 'confirmed'`
2. Hent payment via `getPaymentByBookingId(booking.id)`
3. Ejer-annullering giver **altid fuld refund** uanset timing — Stripe refund hvis `payment?.status === 'paid'`:
   ```typescript
   const session = await stripe.checkout.sessions.retrieve(
     payment.stripe_checkout_session_id,
     { expand: ["payment_intent"] }
   );
   const pi = session.payment_intent as { id?: string };
   if (pi.id) await stripe.refunds.create({ payment_intent: pi.id });
   ```
4. Opdater booking: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'owner'`
5. Send email til gæst (annulleret af ejer + refund-info) via `sendOwnerCancelledToGuest`
6. Return `{ ok: true, refunded: boolean }`

**Fejlhåndtering:** Samme som gæst-cancel — Stripe-fejl stopper ikke annulleringen.

---

### `PATCH /api/owner/[token]/settings` — udvidelse

Tilføj håndtering af `cancellation_cutoff_hours` feltet:

```typescript
if ("cancellation_cutoff_hours" in body) {
  const hours = Number(body.cancellation_cutoff_hours);
  if (![24, 48, 72, 168].includes(hours))
    return NextResponse.json({ error: "Ugyldig afbestillingsfrist" }, { status: 400 });
  // update bookable_shelters
}
```

---

## Email-funktioner

### `sendGuestCancelledToGuest`

Til gæsten når de selv annullerer.

- Subject: `"Din booking af {shelterTitle} er annulleret"`
- Body:
  - Bookingdetaljer (shelter, datoer)
  - Refund-status: "Du modtager fuld refund inden for 5-10 hverdage" / "Ingen refund iht. afbestillingspolitikken"
  - Link til "Min booking"-siden

### `sendGuestCancelledToOwner`

Til ejeren når en gæst annullerer.

- Subject: `"{guestName} har annulleret sin booking"`
- Body: Gæstenavn, shelter, datoer, refund-status

### `sendOwnerCancelledToGuest`

Til gæsten når ejeren annullerer.

- Subject: `"Din booking af {shelterTitle} er annulleret af ejeren"`
- Body:
  - Undskyldning og tydelig forklaring
  - "Du modtager fuld refund inden for 5-10 hverdage" (altid fuld refund)
  - Link til shelterside til at finde alternativ

### Eksisterende emails der opdateres

`sendBookingConfirmedToGuest`, `sendPaymentConfirmed` og `sendPaymentRequestToGuest` tilføjer alle et "Se din booking"-link og modtager en ny `guestToken: string` parameter:

```
Se og administrér din booking:
https://shelterdk.dk/min-booking/[guest_token]
```

---

## Dashboard UI

### Cancel-knap på bekræftede bookinger

- Diskret tekstknap (ikke rød primær-knap) ved siden af "Bekræftet"-badge: `"Annullér"`
- Klik åbner **inline confirmation-panel** (ikke modal/overlay — åbner i bookingkortet):

```
┌──────────────────────────────────────────┐
│  Er du sikker?                           │
│  Lars Andersen · 23–25. maj · 3 pers.   │
│                                          │
│  Gæsten vil modtage besked og fuld       │
│  refund (hvis betaling er gennemført).  │
│                                          │
│  [Ja, annullér]  [Fortryd]               │
└──────────────────────────────────────────┘
```

- Under annullering: loading state på knap
- Efter annullering: bookingen viser "Annulleret af dig" badge, cancel-knap fjernes

### Annullerede bookinger i listerne

- Vises i "Alle bookinger"-sektionen med `"Annulleret"` badge (grå)
- Vises IKKE i "Afventer svar" eller "Kommende bookinger"

### Afbestillingspolitik-sektion

Ny sektion i dashboard under "Priser":

```
┌────────────────────────────────────────────┐
│  Afbestillingsregler                        │
│                                             │
│  Gæster kan annullere op til check-in.     │
│  Vælg hvor lang tid før ankomst de får     │
│  fuld refund:                              │
│                                             │
│  [Dropdown: 24 timer / 48 timer /          │
│             72 timer / 7 dage]             │
│                                             │
│  [Gem] ✓ Gemt                              │
└────────────────────────────────────────────┘
```

Følger samme dirty-state/gem-mønster som pris- og besked-sektionerne.

---

## lib/booking-db.ts — nye helpers

```typescript
/** Opslag via guest_token — bruges af gæstesiden og cancel-API */
export async function getBookingByGuestToken(
  guestToken: string
): Promise<ShelterBooking | null>

/**
 * Markér booking som annulleret — bruges af begge cancel-routes.
 * Eksisterende updateBookingStatus() kan ikke bruges: den kræver status='pending'
 * og understøtter ikke cancelled_at/cancelled_by felterne.
 */
export async function cancelBooking(
  bookingId: string,
  cancelledBy: "owner" | "guest"
): Promise<void>
// Implementering: UPDATE shelter_bookings SET status='cancelled',
//   cancelled_at=now(), cancelled_by=$cancelledBy, updated_at=now()
//   WHERE id=$bookingId AND status='confirmed'
```

`getBookingByGuestToken` returnerer kun `ShelterBooking`-felter (inkl. `bookable_shelter_id`). API-routes der også behøver shelter-data foretager en separat query.

Payment-data hentes via `getPaymentByBookingId(booking.id)` fra `lib/payment-db.ts`. Dashboard-bekræftelsespanelet viser "Gæsten vil modtage fuld refund" — det specifikke beløb vises ikke i dashboard (ingen ekstra fetch nødvendig). Beløbet fremgår af gæstens email.

---

## Refund-logik — sammenfatning

Refund-berettigelse er uafhængig af `payment_mode` — det eneste der tæller er `payment.status = 'paid'` og timing.

| Hvem annullerer | payment.status | Timing | Refund? |
|-----------------|---------------|--------|---------|
| Gæst | paid | > cutoff timer til check_in | Fuld |
| Gæst | paid | ≤ cutoff timer til check_in | Ingen |
| Gæst | pending/expired/null | — | Ingen (ikke betalt) |
| Ejer | paid | Uanset | Altid fuld |
| Ejer | pending/expired/null | — | Ingen (ikke betalt) |

---

## Link til "Min booking" — hvornår sendes det

| Email | Inkluderer link? |
|-------|-----------------|
| `sendBookingReceivedToGuest` (forespørgsel modtaget) | Nej — ikke bekræftet endnu |
| `sendBookingConfirmedToGuest` (upfront, ejer bekræfter) | Ja |
| `sendPaymentRequestToGuest` (after_confirmation) | Ja |
| `sendPaymentConfirmed` (betaling gennemført) | Ja |
| `sendBookingAutoMessage` (ejerens auto-besked) | Nej — ejerens eget indhold |

---

## Hvad der IKKE bygges i dette scope

- Partial refund (fx 50%)
- Gæsten kan ændre datoer
- Besked-system mellem gæst og ejer
- Annullering af pending bookinger (kun confirmed)
- Admin-override af refund
- Annulleringsårsag fra gæst/ejer
