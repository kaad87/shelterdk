# Automatiske booking-beskeder — Design

**Dato:** 2026-04-27
**Status:** Godkendt af bruger

---

## Mål

Giv shelter-ejere mulighed for at sende automatiske, personaliserede emails til gæster ved to tidspunkter:
1. Når en booking bekræftes
2. Dagen før gæstens ankomst

Formålet er at spare ejere for tidskrævende manuel kommunikation og forbedre gæsteoplevelsen.

---

## Arkitektur

### Stack
- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres)
- Resend (email-afsendelse)
- Netlify Scheduled Functions (cron)

### Komponenter

```
migrations/040_booking_message_templates.sql
app/api/owner/[token]/messages/route.ts
app/api/owner/[token]/action/route.ts        ← udvides
netlify/functions/send-reminders.mts
lib/email.ts                                  ← ny funktion
components/owner/OwnerDashboard.tsx           ← ny sektion
```

---

## Database

### Ny tabel: `booking_message_templates`

```sql
CREATE TABLE booking_message_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id              UUID NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  confirmation_enabled    BOOLEAN NOT NULL DEFAULT true,
  confirmation_subject    TEXT NOT NULL DEFAULT '',
  confirmation_body       TEXT NOT NULL DEFAULT '',
  reminder_enabled        BOOLEAN NOT NULL DEFAULT true,
  reminder_subject        TEXT NOT NULL DEFAULT '',
  reminder_body           TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shelter_id)
);
```

### Ny kolonne: `shelter_bookings.reminder_sent_at`

```sql
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
```

Bruges til idempotens — forhindrer dobbeltsendelse hvis cron'en genstartes.

---

## Pladsholdere

Tilgængelige i både subject og body:

| Pladsholder | Erstattes med |
|------------|---------------|
| `{gæst_navn}` | `booking.guest_name` |
| `{shelter_navn}` | `shelter.title` |
| `{ankomst_dato}` | `booking.check_in` formateret som "fre. 23. maj" |
| `{afrejse_dato}` | `booking.check_out` formateret som "søn. 25. maj" |
| `{antal_nætter}` | Beregnet ud fra check_in og check_out |
| `{antal_personer}` | `booking.guest_count` |

Ukendte pladsholdere ignoreres (erstattes ikke, vises som de er).

---

## Standard-tekster

Vises som forslag første gang ejeren åbner template-editoren (pre-fills hvis ingen template eksisterer endnu).

**Bekræftelse:**
- Subject: `Din booking af {shelter_navn} er bekræftet`
- Body:
  ```
  Hej {gæst_navn},

  Din booking er bekræftet — vi glæder os til at byde dig velkommen.

  Ankomst: {ankomst_dato}
  Afrejse: {afrejse_dato}
  Varighed: {antal_nætter} nætter
  Antal personer: {antal_personer}

  God tur!
  ```

**Påmindelse:**
- Subject: `Reminder: du ankommer til {shelter_navn} i morgen`
- Body:
  ```
  Hej {gæst_navn},

  Bare en reminder — du ankommer til {shelter_navn} i morgen ({ankomst_dato}).

  Vi ses!
  ```

---

## API

### `GET /api/owner/[token]/messages`
Returnerer shelterens aktuelle templates. Returnerer standard-teksterne hvis ingen template endnu eksisterer (uden at gemme dem — de gemmes først ved PATCH).

**Response:**
```json
{
  "confirmation_enabled": true,
  "confirmation_subject": "...",
  "confirmation_body": "...",
  "reminder_enabled": true,
  "reminder_subject": "...",
  "reminder_body": "..."
}
```

### `PATCH /api/owner/[token]/messages`
Gemmer templates via upsert på `shelter_id`.

**Validering:**
- Hvis `confirmation_enabled = true`: subject og body må ikke være tomme
- Hvis `reminder_enabled = true`: subject og body må ikke være tomme
- Max 200 tegn på subject, max 2000 tegn på body

**Response:** `{ ok: true }`

---

## Bekræftelsesmail

**Trigger:** `POST /api/owner/[token]/action` med `action: "confirm"`

**Flow:**
1. Booking-status sættes til "confirmed" (eksisterende logik)
2. Hent template fra `booking_message_templates` for shelterets `shelter_id`
3. Hvis template ikke findes eller `confirmation_enabled = false` → skip stille
4. Erstat pladsholdere i subject og body
5. Send email til `booking.guest_email` via Resend
6. Returner `{ ..., confirmationEmailSent: true/false }` i response

**Fejlhåndtering:** Email-fejl må ikke forhindre booking-bekræftelsen. Wrap i try/catch — log fejl, men return 200 uanset.

---

## Påmindelsesmail (Netlify Scheduled Function)

**Fil:** `netlify/functions/send-reminders.mts`

**Schedule:** `0 8 * * *` (kl. 08:00 UTC hver dag)

**Flow:**
```
1. Beregn tomorrow = YYYY-MM-DD for næste dag (UTC)
2. Query:
   SELECT b.*, s.title, s.owner_email, t.*
   FROM shelter_bookings b
   JOIN bookable_shelters s ON s.id = b.shelter_id  
   JOIN booking_message_templates t ON t.shelter_id = b.shelter_id
   WHERE b.check_in = tomorrow
     AND b.status = 'confirmed'
     AND b.reminder_sent_at IS NULL
     AND t.reminder_enabled = true
3. For hvert resultat:
   a. Erstat pladsholdere
   b. Send email til booking.guest_email
   c. Sæt reminder_sent_at = now() på bookingen
4. Log: antal forsøgt, antal sendt, antal fejlet
```

**Autentificering:** Header `x-cron-secret` sammenlignes med env `CRON_SECRET`.

**Fejlhåndtering:** Fejl på én booking stopper ikke resten. Alle fejl logges. `reminder_sent_at` sættes KUN efter vellykket afsendelse.

---

## Dashboard UI

Ny sektion nederst i `OwnerDashboard.tsx`: **"Automatiske beskeder"**

### Layout
```
┌─────────────────────────────────────────┐
│ Automatiske beskeder                     │
│                                          │
│ ┌─ Bekræftelsesbesked ──────────────┐   │
│ │ [Toggle: til/fra]                  │   │
│ │ Emne: [________________]           │   │
│ │ Besked: [                      ]   │   │
│ │         [                      ]   │   │
│ │ Pladsholdere:                      │   │
│ │ [{gæst_navn}] [{ankomst_dato}] ... │   │
│ │                                    │   │
│ │ Preview:                           │   │
│ │ ┌──────────────────────────────┐  │   │
│ │ │ Hej Lars, din booking af...  │  │   │
│ │ └──────────────────────────────┘  │   │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌─ Påmindelsesbesked ───────────────┐   │
│ │ [Toggle: til/fra]                  │   │
│ │ ... (samme struktur) ...           │   │
│ └────────────────────────────────────┘  │
│                                          │
│ [Gem beskeder]                           │
└─────────────────────────────────────────┘
```

### UX-detaljer
- Pladsholder-chips er klikbare — indsætter teksten ved cursorens position i det aktive tekstfelt
- Preview opdateres live mens ejeren skriver, med eksempel-værdier (navn: "Lars", shelter: shelterens rigtige navn, datoer: næste weekend)
- Toggle off gråtoner felterne og viser "Beskeden er slået fra"
- Gem-knap er disabled indtil der er ændringer (dirty state)
- Efter gem: "✓ Beskeder gemt" feedback i 3 sekunder
- Bekræftelsesmail-status vises i pending booking-kort: lille "✓ Bekræftelsesmail sendt" badge

### State-håndtering
Ny useState-blok i OwnerDashboard — henter templates via GET ved mount, PATCH ved gem. Følger præcis samme mønster som den eksisterende pris-sektion.

---

## Env-variabler

| Variabel | Brug |
|----------|------|
| `CRON_SECRET` | Autentificering af Netlify scheduled function |

`RESEND_API_KEY` og `SUPABASE_SERVICE_ROLE_KEY` bruges allerede og kræver ikke ny konfiguration.

---

## Hvad der IKKE bygges i dette scope

- Push-notifikationer eller SMS
- Besked-historik / log til ejeren
- Gæst kan svare på emails (reply-to kan sættes til owner_email som en nem forbedring senere)
- Tak-besked efter afrejse (feature C fra backlog)
- Tredje beskedtype (check-ud påmindelse, regler-email etc.)

---

## Migrations-nummer

`040_booking_message_templates.sql`
