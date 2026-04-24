# Shelter Booking MVP — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Byg et booking-system til shelters der ikke har et — som en hosted side på shelterdk.dk og en embeddbar iframe-widget til shelter-ejere med egen hjemmeside.

**Arkitektur:** Booking-siden lever på `shelterdk.dk/embed/book/[slug]` (via det eksisterende `/app/embed/`-route-group uden navbar/footer) og genbruges som iframe-kilde. Ejeren administrerer via et token-beskyttet dashboard. Emails sendes via det eksisterende `lib/email.ts` (Resend er allerede installeret).

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), Resend via `lib/email.ts` (allerede konfigureret), react-day-picker (ny afhængighed), TypeScript.

---

## 1. Brugerflow

### To indgange til booking
1. Fra shelter-detailsiden på shelterdk.dk ("Book dette shelter"-knap — vises kun for `bookable_shelters`)
2. Via iframe embeddet på ejerens hjemmeside (`/embed/book/[slug]` i iframen)

### Bookingformular (`/embed/book/[slug]`)
Siden lever i det eksisterende `/app/embed/`-route-group, som allerede har sin egen layout uden navbar/footer. Ingen `?embed=1`-parameter nødvendig.

Brugeren:
1. Ser en kalender med farvekodning:
   - Grøn = ledig
   - Gul = pending (afventer ejer-svar)
   - Rød = bekræftet/optaget
   - Grå = blokeret af ejer
2. Vælger ankomst- og afrejsedato (kun ledige dage kan vælges; fortiden er deaktiveret)
3. Udfylder: navn (maks 100 tegn), email (server-side valideret), antal personer (1–max_persons), valgfri besked (maks 500 tegn)
4. Sender forespørgsel

**Server-side validering på `POST /api/book/[slug]`:**
- `guest_name`: krævet, 1–100 tegn
- `guest_email`: krævet, valid email-format
- `guest_count`: krævet, 1–max_persons
- `check_in`: krævet, ikke i fortiden
- `check_out`: krævet, skal være efter `check_in`
- `message`: valgfri, maks 500 tegn

### Efter indsendelse
- Bruger lander på `/embed/book/[slug]/tak` — "Din forespørgsel er sendt. Ejeren vender tilbage hurtigst muligt." — inkl. link til `shelterdk.dk` (virker også i iframe-kontekst som et `target="_blank"`-link)
- Bruger modtager email: "Vi har modtaget din forespørgsel til [shelter-navn] ([dato]–[dato]). Du hører fra ejeren snart."
- Ejer modtager email med [Acceptér]- og [Afvis]-links

### Ejer accepterer/afviser
- For hvert booking oprettes **to** rækker i `booking_action_tokens` — én med `action='confirm'`, én med `action='reject'`
- Ejer klikker link i email → `GET /api/booking/action/[token]` → API'en slår token op, henter `action`-feltet, udfører handlingen, markerer `used_at`
- Siden `/booking/svar/[token]` viser resultatet **efter** at API'en har udført handlingen — handlingen sker ved GET, da det er et simpelt engangslink fra email. Tokens er single-use og idempotente (brugt token returnerer "allerede behandlet"-besked)
- Bruger modtager email med enten bekræftelse eller afslag
- Ved accept: datoen markeres som bekræftet (rød) på kalenderen
- Ved afslag: datoen frigives igen (grøn)

### Race condition ved dobbelt-booking
Hvis to gæster sender forespørgsel for overlappende datoer, kan begge lande i `pending`-status — det er tilladt. Når ejeren **accepterer** en booking, tjekker API'en om der allerede eksisterer en `confirmed`-booking der overlapper. Hvis ja, afvises accept-handlingen med en fejlbesked til ejeren: "En anden booking overlapper disse datoer. Acceptér ikke begge." Ejeren skal afvise den ene manuelt. Dette er en MVP-begrænsning der accepteres bevidst.

---

## 2. Shelter-ejerens oplevelse

### Onboarding (MVP: manuel af admin)
Admin opretter en `bookable_shelter`-post i Supabase med:
- Shelternavn, slug, ejer-email, max antal personer
- Optional FK til eksisterende `shelters`-tabel (se sektion 3 for detaljer)
- Auto-genereret `owner_token` (UUID)

Ejeren modtager email med link til sit dashboard: `shelterdk.dk/owner/[token]`

**Sikkerhedsmodel for `owner_token` (MVP-begrænsning):** Token er et persistent UUID uden udløbsdato. Det eksponeres i browserhistorik, server-logs og email. Revokering kræver manuel ændring i Supabase. Dette er en bevidst MVP-begrænsning — produktionsversionen bør bruge session-baseret auth.

### Ejerdashboard (`/owner/[token]`)
- **Kalendervisning** — månedsvisning der viser alle bookings med status
- **Bookingliste** — kommende bookings med navn, email, antal, datoer, status
- **Pending bookings** — acceptér/afvis direkte fra dashboardet (alternativ til email-links)
- **Bloker datoer** — ejer kan markere datoer som utilgængelige (fx "vi er der selv")
- **Embed-kode** — klar til copy-paste:
  ```html
  <iframe
    src="https://shelterdk.dk/embed/book/[slug]"
    width="100%"
    height="620"
    frameborder="0"
    style="border-radius:8px; border:1px solid #e5e7eb;"
    title="Book [shelter-navn]"
  ></iframe>
  <p style="text-align:center; font-size:12px; color:#6b7280; margin-top:6px;">
    <a href="https://shelterdk.dk" target="_blank" rel="noopener">Leveret af ShelterDK</a>
  </p>
  ```

---

## 3. Database-skema

### `bookable_shelters`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug            text UNIQUE NOT NULL          -- fx "skovly-shelter"
title           text NOT NULL                 -- brugt på bookingsiden hvis shelter_id er null
description     text
shelter_id      uuid REFERENCES shelters(id)  -- nullable FK til eksisterende shelter
                -- Når sat: bookingsiden kan vise shelterdata (billeder, region osv.) fra shelters-tabellen
                -- Når null: bookingsiden bruger title/description fra denne tabel alene
                -- slug på bookable_shelters er uafhængig af slug på shelters
owner_email     text NOT NULL
owner_token     uuid UNIQUE DEFAULT gen_random_uuid()
max_persons     int NOT NULL DEFAULT 6
created_at      timestamptz DEFAULT now()
```

### `shelter_bookings`
```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid()
bookable_shelter_id  uuid REFERENCES bookable_shelters(id) NOT NULL
guest_name           text NOT NULL
guest_email          text NOT NULL
guest_count          int NOT NULL
check_in             date NOT NULL
check_out            date NOT NULL
message              text
status               text NOT NULL DEFAULT 'pending'
                     -- 'pending' | 'confirmed' | 'rejected' | 'cancelled'
created_at           timestamptz DEFAULT now()
updated_at           timestamptz DEFAULT now()
```

### `booking_action_tokens`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      uuid REFERENCES shelter_bookings(id) NOT NULL
action          text NOT NULL  -- 'confirm' | 'reject'
token           uuid UNIQUE DEFAULT gen_random_uuid()
expires_at      timestamptz NOT NULL  -- 7 dage fra oprettelse
used_at         timestamptz           -- nullable, sættes når brugt
```

### `shelter_blocked_dates`
```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid()
bookable_shelter_id  uuid REFERENCES bookable_shelters(id) NOT NULL
blocked_date         date NOT NULL
reason               text          -- valgfri intern note til ejeren
created_at           timestamptz DEFAULT now()
UNIQUE (bookable_shelter_id, blocked_date)
```

**RLS-politik:** Alle tabeller er read-only for anon. Insert/update kun via service role (API routes med admin-client).

---

## 4. API Routes

| Route | Metode | Beskrivelse |
|-------|--------|-------------|
| `/api/book/[slug]` | POST | Opret bookingforespørgsel, send emails, opret to action tokens |
| `/api/book/[slug]/availability` | GET | Returnér optagne/pending/blokerede datoer (public) |
| `/api/booking/action/[token]` | GET | Acceptér eller afvis booking via email-link |
| `/api/owner/[token]/bookings` | GET | Hent alle bookings for ejeren (dashboard) |
| `/api/owner/[token]/block` | POST | Bloker/afbloker datoer |
| `/api/owner/[token]/action` | POST | Acceptér/afvis direkte fra dashboard |

Alle `/api/owner/[token]/...`-routes validerer `owner_token` mod `bookable_shelters`.

### Availability API — response-format
```typescript
// GET /api/book/[slug]/availability
// Response:
{
  dates: {
    [isoDate: string]: "pending" | "confirmed" | "blocked"
    // Kun optagne/pending/blokerede datoer returneres.
    // Datoer der ikke er i objektet er ledige.
  }
}
// Eksempel:
{
  dates: {
    "2026-05-10": "confirmed",
    "2026-05-11": "confirmed",
    "2026-05-17": "pending",
    "2026-05-24": "blocked"
  }
}
```

---

## 5. Sider (Next.js App Router)

| Sti | Type | Beskrivelse |
|-----|------|-------------|
| `/embed/book/[slug]` | Client Component | Bookingformular + kalender. Lever i eksisterende `/app/embed/`-route-group (ingen navbar/footer) |
| `/embed/book/[slug]/tak` | Server Component | "Forespørgsel sendt"-bekræftelse. Inkl. `target="_blank"`-link til shelterdk.dk |
| `/booking/svar/[token]` | Server Component | Viser resultat af accept/afvis. Inkluderer "Gå til dashboard"-link |
| `/owner/[token]` | Client Component | Ejerdashboard med kalender, bookingliste, bloker-funktion, embed-kode |

**Brug af `/app/embed/`-route-group:** Det eksisterende route-group har sin egen `layout.tsx` uden navbar/footer. `/embed/book/[slug]` placeres her. Iframen hos ejeren embedder denne URL direkte — ingen query-params nødvendige.

**`next.config.js` — iframe-headers:** `/embed/`-routes skal tillade indlejring fra alle domæner. Tilføj en header-override i `next.config.js`:
```javascript
// Eksisterende config sætter X-Frame-Options: SAMEORIGIN globalt.
// Overstyr for /embed/-routes:
{
  source: '/embed/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'ALLOWALL' },
    { key: 'Content-Security-Policy', value: "frame-ancestors *" }
  ]
}
```

---

## 6. Email-templates (via eksisterende `lib/email.ts`)

Brug `sendEmail()`-funktionen fra `lib/email.ts`. Afsender-adresse: brug den eksisterende konfigurerede `FROM_EMAIL`-env-variabel (eller `noreply@shelterdk.dk` hvis en Resend-afsenderdomain er sat op — tjek `.env`).

### Til ejer — ny forespørgsel
```
Emne: Ny bookingforespørgsel til [shelter-navn]

[Navn] ([email]) har sendt en forespørgsel:
Datoer: [check_in] → [check_out]
Antal: [guest_count] personer
Besked: [message]

[ACCEPTÉR BOOKING] ← https://shelterdk.dk/api/booking/action/[confirm-token]
[AFVIS BOOKING]    ← https://shelterdk.dk/api/booking/action/[reject-token]

Eller administrér via dit dashboard: https://shelterdk.dk/owner/[owner_token]
```

### Til gæst — forespørgsel modtaget
```
Emne: Vi har modtaget din forespørgsel til [shelter-navn]

Hej [navn], din forespørgsel for [check_in]–[check_out] er sendt til ejeren.
Du hører fra os snart.
```

### Til gæst — bekræftelse
```
Emne: Din booking er bekræftet! 🎉

Hej [navn], din booking af [shelter-navn] fra [check_in] til [check_out] er bekræftet.
God tur!
```

### Til gæst — afslag
```
Emne: Din bookingforespørgsel til [shelter-navn]

Hej [navn], desværre kunne ejeren ikke imødekomme din forespørgsel for [check_in]–[check_out].
Find andre shelters på shelterdk.dk
```

---

## 7. Iframe-widget

Bookingsiden på `/embed/book/[slug]` er designet til iframe via det eksisterende embed-route-group:
- Ingen navbar/footer (håndteret af layoutet)
- Kompakt padding
- Hvid baggrund, responsive
- `next.config.js` override fjerner `X-Frame-Options: SAMEORIGIN` for `/embed/`-routes

Ejeren får dette embed-kodestykke fra dashboardet (copy-paste-klar).

---

## 8. Hvad der IKKE er med i MVP

- Betaling / transaktionsgebyr
- Brugerkonti / login
- Selvbetjenings-registrering for ejere (admin opretter manuelt)
- Kalender-sync (Google Calendar, iCal)
- SMS-notifikationer
- Tilpasning af widget-farver
- Kapacitetsstyring med overlappende grupper
- Annullerings-flow for gæster (kun ejeren kan aflyse via dashboard)
- Session-baseret auth til ejerdashboard (owner_token er persistent UUID — MVP-begrænsning)

---

## 9. Afhængigheder

- **react-day-picker** — kalenderkomponent (ny, installeres med `npm install react-day-picker`)
- **Resend** — allerede installeret (`"resend": "^6.9.4"` i `package.json`). Brug `lib/email.ts`
- **Supabase admin client** — allerede konfigureret i projektet

---

## 10. Verifikation

**Happy path:**
1. Opret et test-shelter manuelt i Supabase (`bookable_shelters`)
2. Besøg `/embed/book/test-shelter` — kalender vises, fortiden er deaktiveret
3. Send forespørgsel — ejer modtager email med accept/afvis-links, gæst modtager "modtaget"-email
4. Klik acceptér-link — gæst modtager bekræftelse, dato vises rød på kalender
5. Klik afvis-link — dato frigives, gæst modtager afslag
6. Besøg `/owner/[token]` — bookings vises korrekt, datoer kan blokeres
7. Embed-koden fungerer i en `<iframe>` på en blank HTML-side på et andet domæne

**Fejlscenarier:**
8. Forsøg at booke en dato der allerede er `confirmed` eller `pending` — fejl returneres
9. Klik et accept/afvis-link der allerede er brugt (`used_at IS NOT NULL`) — siden viser "Denne handling er allerede udført"
10. Klik et udløbet token (`expires_at < now()`) — siden viser "Dette link er udløbet. Gå til dit dashboard"
11. Race condition: accept to overlappende `pending` bookings — anden accept fejler med overlap-fejl
12. Ugyldig slug på `/embed/book/[slug]` — `notFound()` returneres
13. Ugyldig `owner_token` — 401/404 returneres
14. Formularindsendelse med check_out før check_in — server-side validering returnerer 400
