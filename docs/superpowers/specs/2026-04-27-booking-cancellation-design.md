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
app/(site)/booking/[guestToken]/page.tsx        ← ny gæsteside
app/api/booking/[guestToken]/cancel/route.ts    ← gæst annullerer
app/api/owner/[token]/action/route.ts           ← udvides med "cancel"
app/api/owner/[token]/settings/route.ts         ← udvides med cancellation_cutoff_hours
lib/booking-email.ts                            ← +2 cancel-emails
lib/booking-db.ts                               ← +getBookingByGuestToken helper
types/booking.ts                                ← opdateres med nye felter
components/owner/OwnerDashboard.tsx             ← cancel-knap + policy-sektion
```

---

## Database

### Ændringer på `shelter_bookings`

```sql
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS guest_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('owner', 'guest', 'system'));

-- Populér guest_token for eksisterende rækker (DEFAULT gælder kun nye)
UPDATE shelter_bookings SET guest_token = gen_random_uuid()
  WHERE guest_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shelter_bookings_guest_token_unique
  ON shelter_bookings (guest_token);
```

### Ændringer på `bookable_shelters`

```sql
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INT NOT NULL DEFAULT 48;
```

Semantik: gæster modtager fuld refund hvis de annullerer mere end `cancellation_cutoff_hours` timer før `check_in`. Annullering tættere på check-in = ingen refund. Cancellation er altid tilladt (op til check-in dagen).

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

---

## Gæsteside — `/booking/[guestToken]`

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
- Stripe-fejl → "Annullering gennemført, men refund fejlede. Kontakt [owner_email]."

---

## API

### `POST /api/booking/[guestToken]/cancel`

**Auth:** Ingen header-auth — `guestToken` er hemmeligheden.

**Flow:**
1. Hent booking via `guest_token`
2. Valider: status = `confirmed`, `check_in` > today
3. Hent shelter (for `cancellation_cutoff_hours` og `payment_mode`)
4. Hent payment for booking (for refund-beregning)
5. Beregn refund-berettigelse:
   ```
   hoursUntilCheckIn = (checkIn - now) / 3600_000
   fullRefund = hoursUntilCheckIn > shelter.cancellation_cutoff_hours
   ```
6. Hvis upfront + payment.status = 'paid' + fullRefund → Stripe refund
7. Opdater booking: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'guest'`
8. Send email til gæst (bekræftelse + refund-info)
9. Send email til ejer (notifikation)
10. Return `{ ok: true, refunded: boolean }`

**Fejlhåndtering:** Stripe-fejl stopper IKKE annulleringen. Booking markeres cancelled og der logges. Response indeholder `refundError: true` så siden kan vise passende besked.

---

### `POST /api/owner/[token]/action` — udvidelse med `"cancel"`

**Ny action:** `action: "cancel"`

**Flow:**
1. Valider: `booking.status === 'confirmed'`
2. Ejer-annullering giver **altid fuld refund** uanset timing
3. Stripe refund hvis payment.status = 'paid'
4. Opdater booking: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'owner'`
5. Send email til gæst (annulleret af ejer + refund-info)
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

`sendBookingConfirmedToGuest` og `sendPaymentConfirmed` tilføjer et "Se din booking"-link:

```
Se og administrér din booking:
https://shelterdk.dk/booking/[guest_token]
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
│  Gæsten vil modtage besked og            │
│  fuld refund på 350 kr.                  │
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

## lib/booking-db.ts — ny helper

```typescript
export async function getBookingByGuestToken(
  guestToken: string
): Promise<ShelterBooking | null>
```

Bruges af gæstesiden og cancel-API.

---

## Refund-logik — sammenfatning

| Hvem annullerer | payment_mode | payment.status | Refund? |
|-----------------|-------------|---------------|---------|
| Gæst (> cutoff) | upfront | paid | Fuld |
| Gæst (< cutoff) | upfront | paid | Ingen |
| Gæst | after_confirmation | paid | Fuld (> cutoff) / Ingen (< cutoff) |
| Gæst | after_confirmation | pending/expired | Ingen (ikke betalt) |
| Ejer | begge | paid | Altid fuld |
| Ejer | begge | pending/expired | Ingen (ikke betalt) |

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
