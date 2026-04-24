# Shelter Booking MVP — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Byg et booking-system til shelters der ikke har et — som en hosted side på shelterdk.dk og en embeddbar iframe-widget til shelter-ejere med egen hjemmeside.

**Arkitektur:** Booking-siden lever på `shelterdk.dk/book/[slug]` og fungerer both som direkte URL og som iframe-kilde. Ejeren administrerer via et token-beskyttet dashboard. Emails sendes via Resend.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), Resend (email), react-day-picker (kalender), TypeScript.

---

## 1. Brugerflow

### To indgange til booking
1. Fra shelter-detailsiden på shelterdk.dk ("Book dette shelter"-knap — vises kun for bookbare shelters)
2. Via iframe embeddet på ejerens hjemmeside

### Bookingformular (`/book/[slug]`)
Siden er designet til at fungere standalone (direkte URL) og som iframe (ingen navbar/footer, kompakt layout).

Brugeren:
1. Ser en kalender med farvekodning:
   - Grøn = ledig
   - Gul = pending (afventer ejer-svar)
   - Rød = bekræftet/optaget
   - Grå = blokeret af ejer
2. Vælger ankomst- og afrejsedato (kun ledige dage kan vælges)
3. Udfylder: navn, email, antal personer (1–max_persons), valgfri besked til ejer
4. Sender forespørgsel

### Efter indsendelse
- Bruger lander på `/book/[slug]/tak` — "Din forespørgsel er sendt. Ejeren vender tilbage hurtigst muligt."
- Bruger modtager email: "Vi har modtaget din forespørgsel til [shelter-navn] ([dato]–[dato]). Du hører fra ejeren snart."
- Ejer modtager email med [Acceptér]- og [Afvis]-links

### Ejer accepterer/afviser
- Ejer klikker link i email → lander på `/booking/svar/[token]` → siden viser bekræftelse på valget
- Bruger modtager email med enten bekræftelse eller afslag
- Ved accept: datoen markeres som bekræftet (rød) på kalenderen
- Ved afslag: datoen frigives igen (grøn)

---

## 2. Shelter-ejerens oplevelse

### Onboarding (MVP: manuel af admin)
Admin opretter en `bookable_shelter`-post i Supabase med:
- Shelternavn, slug, ejer-email, max antal personer
- FK til eksisterende `shelters`-tabel (optional — kan stå alene)
- Auto-genereret `owner_token` (UUID)

Ejeren modtager et email med link til sit dashboard: `shelterdk.dk/owner/[token]`

### Ejerdashboard (`/owner/[token]`)
- **Kalendervisning** — månedsvisning der viser alle bookings med status
- **Bookingliste** — kommende bookings med navn, email, antal, datoer, status
- **Bloker datoer** — ejer kan markere datoer som utilgængelige (fx "vi er der selv")
- **Embed-kode** — klar til copy-paste:
  ```html
  <iframe
    src="https://shelterdk.dk/book/[slug]"
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
- **Pending bookings** — knapper til at acceptere/afvise direkte fra dashboardet (alternativ til email-links)

---

## 3. Database-skema

### `bookable_shelters`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug            text UNIQUE NOT NULL          -- fx "skovly-shelter"
title           text NOT NULL
description     text
shelter_id      uuid REFERENCES shelters(id)  -- nullable FK til eksisterende shelter
owner_email     text NOT NULL
owner_token     uuid UNIQUE DEFAULT gen_random_uuid()
max_persons     int NOT NULL DEFAULT 6
created_at      timestamptz DEFAULT now()
```

### `shelter_bookings`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
bookable_shelter_id  uuid REFERENCES bookable_shelters(id) NOT NULL
guest_name      text NOT NULL
guest_email     text NOT NULL
guest_count     int NOT NULL
check_in        date NOT NULL
check_out       date NOT NULL
message         text
status          text NOT NULL DEFAULT 'pending'
                -- 'pending' | 'confirmed' | 'rejected' | 'cancelled'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
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

**RLS-politik:** Alle tabeller er read-only for anon. Insert/update kun via service role (API routes med admin-client).

---

## 4. API Routes

| Route | Metode | Beskrivelse |
|-------|--------|-------------|
| `/api/book/[slug]` | POST | Opret bookingforespørgsel, send emails, opret action tokens |
| `/api/book/[slug]/availability` | GET | Returnér optagne/pending/blokerede datoer (public) |
| `/api/booking/action/[token]` | GET | Acceptér eller afvis booking via email-link |
| `/api/owner/[token]/bookings` | GET | Hent alle bookings for ejeren (dashboard) |
| `/api/owner/[token]/block` | POST | Bloker/afbloker datoer |
| `/api/owner/[token]/action` | POST | Acceptér/afvis direkte fra dashboard |

Alle `/api/owner/[token]/...`-routes validerer `owner_token` mod `bookable_shelters`.

---

## 5. Sider (Next.js App Router)

| Sti | Type | Beskrivelse |
|-----|------|-------------|
| `/book/[slug]` | Client Component | Bookingformular + kalender. Iframe-venligt layout (ingen navbar/footer når `?embed=1`) |
| `/book/[slug]/tak` | Server Component | "Forespørgsel sendt"-bekræftelse |
| `/booking/svar/[token]` | Server Component | Håndterer accept/afvis fra email-link, viser resultat |
| `/owner/[token]` | Client Component | Ejerdashboard med kalender, bookingliste, bloker-funktion, embed-kode |

`/book/[slug]` detekterer `?embed=1` i URL og skjuler navbar/footer for at passe i iframe.

---

## 6. Email-templates (Resend)

### Til ejer — ny forespørgsel
```
Emne: Ny bookingforespørgsel til [shelter-navn]

[Navn] ([email]) har sendt en forespørgsel:
Datoer: [check_in] → [check_out]
Antal: [guest_count] personer
Besked: [message]

[ACCEPTÉR BOOKING] ← link til /booking/svar/[confirm-token]
[AFVIS BOOKING]    ← link til /booking/svar/[reject-token]

Eller administrér via dit dashboard: shelterdk.dk/owner/[owner_token]
```

### Til gæst — forespørgsel modtaget
```
Emne: Vi har modtaget din forespørgsel til [shelter-navn]

Hej [navn],
Din forespørgsel for [check_in]–[check_out] er sendt til ejeren.
Du hører fra os snart.
```

### Til gæst — bekræftelse
```
Emne: Din booking er bekræftet! 🎉

Hej [navn],
Din booking af [shelter-navn] fra [check_in] til [check_out] er bekræftet.
God tur!
```

### Til gæst — afslag
```
Emne: Din bookingforespørgsel til [shelter-navn]

Hej [navn],
Desværre kunne ejeren ikke imødekomme din forespørgsel for [check_in]–[check_out].
Find andre shelters på shelterdk.dk
```

---

## 7. Iframe-widget

Bookingsiden på `/book/[slug]?embed=1` er designet til at fungere i en `<iframe>`:
- Ingen navbar/footer
- Kompakt padding
- Hvid baggrund, responsive
- Tilpasser højde via `postMessage` til forældresiden (optional enhancement)

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
- Annullerings-flow for gæster

---

## 9. Afhængigheder

- **Resend** — transaktionelle emails (ny afhængighed, nem at tilføje)
- **react-day-picker** — kalenderkomponent (let, understøtter range-valg)
- **Supabase admin client** — allerede konfigureret i projektet

---

## 10. Verifikation

1. Opret et test-shelter manuelt i Supabase
2. Besøg `/book/test-shelter` — kalender vises, datoer kan vælges
3. Send forespørgsel — ejer modtager email med accept/afvis-links
4. Klik acceptér-link — gæst modtager bekræftelse, dato vises rød på kalender
5. Klik afvis-link — dato frigives, gæst modtager afslag
6. Besøg `/owner/[token]` — bookings vises, datoer kan blokeres
7. Embed-kode fungerer i en `<iframe>` på en blank HTML-side
8. Prøv at booke en dato der allerede er pending/bekræftet — ikke muligt
9. Action-token kan kun bruges én gang (idempotent)
