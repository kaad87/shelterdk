# Payment & MobilePay Integration Design

**Date:** 2026-04-25
**Status:** Approved

---

## Kontekst

ShelterDK har et booking-system hvor shelters kan acceptere reservationer. To prismodeller eksisterer:

1. **Gratis shelters** — ingen overnatningspris, men ShelterDK opkræver et minimumsgebyr for at dække administration
2. **Betalte shelters** — ejeren opkræver en natpris; ShelterDK tilføjer et transaktionsgebyr

Målet er at implementere et betalingsflow med MobilePay som primær betalingsmetode, bygget på Stripe (som understøtter MobilePay i Danmark via Payment Intents / hosted Checkout).

---

## Beslutninger

| Emne | Beslutning | Rationale |
|------|------------|-----------|
| Betalingstidspunkt | Pay after confirmation | Undgår refund-kompleksitet; ejer bekræfter → gæst betaler |
| Gebyrstruktur | `max(pris × pct, minimum)` | Dækker både gratis (altid minimum) og betalte shelters |
| Udbetalingsmodel | Manuel månedlig udbetaling | MVP-simpelt; Stripe Connect-onboarding er for komplekst i første iteration |
| Betalingsudbyder | Stripe (hosted Checkout) | Bedste developer-tooling, MobilePay out-of-the-box, god webhook-pålidelighed |
| Checkout-type | Stripe hosted Checkout | MobilePay virker i dag, ingen PCI-bekymringer, kan migrere til custom Elements-side senere |

---

## Gebyrformel

```ts
fee = Math.max(Math.round(price × feePct / 100), feeMinDkk)
```

- `price = 0` (gratis shelter): gæsten betaler `feeMinDkk`
- `price > 0`: gæsten betaler `price + max(price × pct / 100, feeMinDkk)`
- Konfigureres per shelter i admin med defaults: `feePct = 5.00`, `feeMinDkk = 25`

---

## Datamodel

### Ændringer i `bookable_shelters`

```sql
ALTER TABLE bookable_shelters
  ADD COLUMN shelter_price_dkk    integer        DEFAULT NULL,   -- natpris, null = gratis
  ADD COLUMN platform_fee_pct     decimal(5,2)   DEFAULT 5.00,
  ADD COLUMN platform_fee_min_dkk integer        DEFAULT 25;
```

### Ny tabel `booking_payments`

```sql
CREATE TABLE booking_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_checkout_session_id  text NOT NULL UNIQUE,  -- UNIQUE: sikrer idempotent webhook-håndtering
  amount_total_dkk            integer NOT NULL,   -- hvad gæsten betaler
  amount_shelter_dkk          integer NOT NULL,   -- til ejer
  amount_platform_dkk         integer NOT NULL,   -- ShelterDKs andel
  status                      text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed','expired')),
  payment_link_sent_at        timestamptz,
  paid_at                     timestamptz,
  expires_at                  timestamptz NOT NULL,  -- +24h fra oprettelse (matcher Stripes maksimum)
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON booking_payments(booking_id);
CREATE INDEX ON booking_payments(status, expires_at);  -- til cron-query
```

### Ny tabel `owner_payouts`

```sql
CREATE TABLE owner_payouts (
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

---

## Betalingsflow

```
1. Owner klikker "Bekræft" på booking
   → booking.status = 'confirmed'
   → Beregn amounts (shelter + platform + total)
   → Opret Stripe Checkout Session:
       - line_items: [{ shelter_price }, { platform_fee }]
       - payment_method_types: ['mobilepay', 'card']
       - metadata: { booking_id }
       - success_url: /booking/[id]/tak
       - cancel_url: /booking/[id]/betal
       - expires_at: Math.floor(Date.now()/1000) + 24*3600  -- Unix timestamp; Stripes maksimum er 24h
   → Gem booking_payments-række (status: pending)
   → Send payment-request e-mail til gæst

2. Gæst klikker link → Stripe hosted checkout
   → Betaler via MobilePay eller kort
   → Stripe redirecter til /booking/[id]/tak

3. Stripe webhook: checkout.session.completed
   → Verificer stripe-signature
   → Find booking_payment via stripe_checkout_session_id
   → booking_payments.status = 'paid', paid_at = now()
   → Send payment-confirmed e-mail til gæst og ejer

4. Nightly cron: udløb af ubetalte betalinger
   → Implementeres som Netlify Scheduled Function (`netlify/functions/expire-payments-cron.ts`)
     med schedule `"0 2 * * *"` (kl. 02:00 UTC hver nat)
   → Kalder `/api/cron/expire-payments` med `x-cron-secret` header (samme mønster som ical-sync)
   → Find booking_payments WHERE status='pending' AND expires_at < now()
   → booking_payments.status = 'expired'
   → bookings.status = 'cancelled'
   → Send booking-expired e-mail til gæst og ejer

5. Admin: månedlig udbetaling
   → Saml paid bookings for shelter i periode
   → Opret owner_payouts-række
   → Markér paid med dato + note
```

**Edge cases:**
- Stripe session-oprettelse fejler → booking forbliver confirmed, ingen payment-række → admin kan manuelt gensende link
- Dobbelt webhook-levering (`checkout.session.completed`) → idempotent check: `IF paid_at IS NOT NULL THEN return 200`
- `checkout.session.expired` webhook → ignoreres bevidst; vores nightly cron håndterer booking-annullering og er autoritativ kilde for expired-status
- Gæst åbner link men betaler ikke → Stripe Session udløber automatisk efter 24h; vores cron annullerer booking senest kl. 02:00 UTC næste nat

**Gæsteadgang til `/booking/[id]/betal` og `/booking/[id]/tak`:**
Disse sider er offentligt tilgængelige men kræver et gyldigt booking-UUID (ikke-gætteligt, ikke eksponeret offentligt). Booking-UUID'et fungerer som et implicit access token — tilstrækkeligt for MVP. Siderne viser kun bookingdetaljer (datoer, shelter-navn, beløb) — ingen persondata der kræver stærkere autentificering.

---

## API-routes

| Method | Path | Formål |
|--------|------|--------|
| POST | `/api/owner/[token]/action` | Eksisterende route — udvides med `action: "confirm"` (opretter Checkout Session) og `action: "resend-payment"` (gensender link) |
| POST | `/api/stripe/webhook` | Stripe event handler — verificeres via `stripe-signature` header |
| GET | `/api/admin/payments` | Liste betalinger — `x-admin-secret` header |
| POST | `/api/admin/payouts` | Opret payout — `x-admin-secret` |
| PATCH | `/api/admin/payouts/[id]` | Markér payout betalt — `x-admin-secret` |
| GET | `/api/cron/expire-payments` | Nightly cron: udløb af betalinger — `x-cron-secret` |

**Admin-auth:** Alle `/api/admin/*`-routes verificeres med `x-admin-secret: process.env.ADMIN_SECRET` header (eksisterende mønster i projektet).

**Ny miljøvariabel:** `ADMIN_SECRET` (hvis ikke allerede defineret i projektet).

---

## Ny lib-fil: `web/lib/stripe.ts`

```ts
// Beregn gebyr
export function calculateFee(
  priceDkk: number,
  feePct: number,
  feeMinDkk: number
): { shelterDkk: number; platformDkk: number; totalDkk: number }

// Opret Stripe Checkout Session, returnerer URL
export async function createCheckoutSession(
  booking: Booking,
  shelter: BookableShelter
): Promise<string>

// Stripe webhook event verificering
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event
```

---

## UI-komponenter

### Owner Dashboard

- **Booking-kort** tilføjes:
  - Betalingsstatus badge: "Afventer betaling" / "Betalt ✓" / "Udløbet"
  - Beløbsoversigt: `450 kr + 25 kr gebyr = 475 kr`
  - "Gensend betalingslink"-knap (vises kun hvis status = pending)
- **Shelter-settings** tilføjes:
  - `Pris per nat: [ ] kr` — tom = gratis

### Nye gæstesider

- `/booking/[id]/betal` — bookingdetaljer + "Betal nu"-knap (redirect til Stripe)
- `/booking/[id]/tak` — Stripe success_url; bekræftelsesbesked

### Admin — nyt afsnit "Betalinger"

To tabs:
- **Transaktioner** — tabel: shelter / gæst / periode / total / gebyr / status / dato
- **Udbetalinger** — per shelter: ubetalt beløb, opret payout, markér betalt

---

## E-mailskabeloner

Tre nye skabeloner (følger eksisterende mønster i projektet):

| Navn | Modtager | Indhold |
|------|----------|---------|
| `payment-request` | Gæst | Bookingdetaljer, betalingslink, 24h deadline |
| `payment-confirmed` | Gæst + Ejer | Betaling modtaget, bookingbekræftelse |
| `booking-expired` | Gæst + Ejer | Booking annulleret pga. manglende betaling |

---

## Miljøvariabler

```
STRIPE_SECRET_KEY              -- Stripe server-side nøgle
STRIPE_WEBHOOK_SECRET          -- Stripe webhook signing secret
CRON_SECRET                    -- Allerede i brug (ical-sync); genbruges til expire-payments
ADMIN_SECRET                   -- Admin API-guard (hvis ikke allerede defineret)
```

Bemærk: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` er ikke nødvendig — Stripe hosted Checkout kræver ingen client-side JS.

---

## Verifikation

1. Opret booking → owner bekræfter → gæst modtager e-mail med Stripe-link
2. Åbn link → MobilePay vises som betalingsmetode
3. Gennemfør betaling (Stripe test mode) → webhook opdaterer status → bekræftelses-e-mail sendes
4. Lad en betaling udløbe → cron annullerer booking → e-mail sendes
5. Admin: opret payout for shelter → markér betalt → vises korrekt i oversigt
6. Gratis shelter: total = platform_fee_min_dkk (kun gebyr, ingen natpris)
7. Betalt shelter med lav pris: total = pris + min_fee (minimum-reglen aktiveres)
8. Betalt shelter med høj pris: total = pris + pct-gebyr (pct-reglen aktiveres)
