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
lib/email.ts                                  ← ny funktion: sendBookingAutoMessage
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

-- Trigger til at holde updated_at opdateret (genbruger eksisterende trigger-funktion hvis den findes)
CREATE TRIGGER booking_message_templates_updated_at
  BEFORE UPDATE ON booking_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Ny kolonne: `shelter_bookings.reminder_sent_at`

```sql
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
```

Bruges til idempotens — forhindrer dobbeltsendelse hvis cron'en genstartes.

---

## FK-kolonnenavne

`shelter_bookings` bruger `bookable_shelter_id` (ikke `shelter_id`) som FK til `bookable_shelters.id`.
`booking_message_templates` bruger `shelter_id` som FK til `bookable_shelters.id`.

Cron-queryen joiner derfor:
```sql
JOIN bookable_shelters s ON s.id = b.bookable_shelter_id
JOIN booking_message_templates t ON t.shelter_id = b.bookable_shelter_id
```

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

**Sikkerhed:** Alle pladsholder-værdier og al ejer-skrevet tekst escapes via den eksisterende `escapeHtml()` i `lib/email.ts` inden de indsættes i HTML-emailen. Newlines i body konverteres til `<br>`.

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

**Adfærd per betalingstilstand:**
- **`after_confirmation`:** Den eksisterende betalings-request email sendes stadig (uændret). Den automatiske bekræftelsesmail sendes DERUDOVER som et personligt velkomst-supplement. Gæsten modtager to emails: betalingslinket og ejerens personlige besked.
- **`upfront`:** Gæsten har allerede betalt. Den automatiske bekræftelsesmail sendes som den primære bekræftelse.

**Flow:**
1. Eksisterende logik kører (status → confirmed, Stripe/betaling som i dag)
2. Hent template fra `booking_message_templates` via `bookable_shelter_id`
3. Hvis template ikke findes eller `confirmation_enabled = false` → skip stille
4. Erstat pladsholdere, escape alle værdier
5. Send email til `booking.guest_email` via Resend
6. Returner `{ ..., confirmationEmailSent: true/false }` i response

**Fejlhåndtering:** Email-fejl må ikke forhindre booking-bekræftelsen. Wrap i try/catch — log fejl, return 200 uanset.

---

## Påmindelsesmail (Netlify Scheduled Function)

**Fil:** `netlify/functions/send-reminders.mts`

**Schedule:** `0 8 * * *` (kl. 08:00 UTC hver dag)

**Autentificering:** Netlify Scheduled Functions kaldes internt af Netlifys scheduler — der er ingen indgående HTTP-request med headers. Funktionen autentificerer sig mod Supabase via `SUPABASE_SERVICE_ROLE_KEY` direkte. Ingen `CRON_SECRET` er nødvendig for den planlagte kørsel.

Hvis en manuel trigger-endpoint ønskes til test (`POST /api/admin/trigger-reminders`), beskyttes den af den eksisterende `ADMIN_SECRET`.

**Flow:**
```
1. Beregn tomorrow = YYYY-MM-DD for næste dag (UTC)
2. Query:
   SELECT b.*, s.title, t.*
   FROM shelter_bookings b
   JOIN bookable_shelters s ON s.id = b.bookable_shelter_id
   JOIN booking_message_templates t ON t.shelter_id = b.bookable_shelter_id
   WHERE b.check_in = tomorrow
     AND b.status = 'confirmed'
     AND b.reminder_sent_at IS NULL
     AND t.reminder_enabled = true
3. For hvert resultat:
   a. Erstat pladsholdere, escape alle værdier
   b. Send email til booking.guest_email
   c. Sæt reminder_sent_at = now() på bookingen
4. Log: antal forsøgt, antal sendt, antal fejlet
```

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
- Efter bekræftelse af booking: lille "✓ Velkomstmail sendt" badge vises i det bekræftede booking-kort (kun hvis `confirmationEmailSent: true` i response)

### State-håndtering
Ny useState-blok i OwnerDashboard — henter templates via GET ved mount, PATCH ved gem. Følger præcis samme mønster som den eksisterende pris-sektion.

---

## Env-variabler

| Variabel | Brug |
|----------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Allerede i brug — bruges af scheduled function |

`RESEND_API_KEY` og `SUPABASE_SERVICE_ROLE_KEY` bruges allerede og kræver ikke ny konfiguration. Ingen nye env-variabler nødvendige.

---

## Hvad der IKKE bygges i dette scope

- Push-notifikationer eller SMS
- Besked-historik / log til ejeren
- Gæst kan svare på emails (reply-to kan sættes til owner_email som en nem forbedring senere)
- Tak-besked efter afrejse (feature C fra backlog)
- Manuel trigger-endpoint (kan tilføjes til test-formål uden for dette scope)

---

## Migrations-nummer

`040_booking_message_templates.sql`
