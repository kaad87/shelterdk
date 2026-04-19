# Shelter Submission Flow — Design Spec

**Date:** 2026-04-19  
**Status:** Approved for implementation

## Mål

Gøre det muligt for ejere/operatører og besøgende brugere at indsende shelters der mangler på ShelterDK, via to separate indgange med forskelligt friktionsniveau — begge funneled ind i én admin-kø.

---

## De to flows

### Flow 1 — Ejer/operatør: `/registrer-shelter`

En dedikeret landingsside til folk der ejer eller driver et shelter. Nås via:
- Direkte link i outreach-emails
- Footer-link
- Evt. navbar

**Side-layout:**
1. Hero-sektion: "Få dit shelter på Danmarks største shelterguide" + 3 trust-bullets (Gratis · Du godkender · Opdatér når du vil)
2. Formular med felter:
   - Navn* (tekst)
   - Adresse/placering* (tekst)
   - Kapacitet (tal, valgfrit)
   - Beskrivelse (textarea, valgfrit)
   - Faciliteter: pill-chips — Vand, Toilet, Bålplads, Parkering, Hund (multi-select toggle)
   - Dit navn (valgfrit)
   - Email* (til bekræftelse)
   - Bookinglink (valgfrit)
3. Submit-knap: "Indsend til gennemgang"
4. Success-state: "Tak! Vi kontakter dig på [email] inden shelteren publiceres."

**Validering:**
- Navn og email er obligatoriske
- Email: standard format
- Kapacitet: tal > 0 hvis udfyldt

### Flow 2 — Besøgende bruger: Modal

En let tilgængelig modal der åbner fra tre steder:
- **Header-knap:** "💡 Mangler dit shelter?" (blå knap, altid synlig)
- **Footer-link:** "Kend du et shelter der mangler?"
- **Søgeside-banner:** "Mangler dit shelter?" under søgeresultater

**Modal-indhold:**
- Shelterens navn* (tekst)
- Placering* (tekst: adresse, by eller postnr)
- Hvad ved du om shelteren? (textarea, valgfrit — maks 500 tegn)
- "Send tip" + "Annuller" knapper
- Footer: "Ingen konto krævet · behandles inden for få dage"

**Ingen billeder påkrævet i Flow 2.** Brugere kender sjældent stedet godt nok.

---

## Database

### Ny tabel: `shelter_submissions`

```sql
CREATE TYPE submission_type AS ENUM ('owner_registration', 'user_tip');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE shelter_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            submission_type NOT NULL,
  status          submission_status NOT NULL DEFAULT 'pending',
  
  -- Shelter info (begge flows)
  shelter_name    text NOT NULL,
  location_text   text NOT NULL,
  
  -- Udvidet info (primært Flow 1)
  capacity        integer         CHECK (capacity IS NULL OR capacity > 0),
  description     text,
  facilities      jsonb,           -- kanoniske nøgler: vand, toilet, baalplads, parkering, hund
  booking_url     text,
  
  -- Kontakt (Flow 1)
  contact_name    text,
  contact_email   text            CHECK (type != 'owner_registration' OR contact_email IS NOT NULL),
  
  -- Ekstra info (Flow 2)
  source_info     text            CHECK (source_info IS NULL OR char_length(source_info) <= 500),
  
  -- Admin
  admin_note      text,
  rejected_reason text,
  reviewed_at     timestamptz,
  
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: kun service_role må læse/skrive
ALTER TABLE shelter_submissions ENABLE ROW LEVEL SECURITY;
-- Ingen public policy — data er privat
```

---

## API Routes

### `POST /api/submit-shelter`

Modtager begge flows baseret på `type`-feltet.

**Request body:**
```json
{
  "type": "owner_registration" | "user_tip",
  "shelter_name": "Shelter ved Silkeborg Sø",
  "location_text": "Silkeborg",
  "capacity": 6,
  "description": "...",
  "facilities": { "vand": true, "toilet": false },
  "booking_url": "https://...",
  "contact_name": "Lars Hansen",
  "contact_email": "lars@example.dk",
  "source_info": "Hvad brugeren ved..."
}
```

**Validering:**
- `type` påkrævet, skal være et af de to enum-værdier
- `shelter_name` og `location_text` påkrævet, maks 200 tegn
- `contact_email` påkrævet ved `owner_registration`, valideres
- `source_info` maks 500 tegn
- Rate limiting: max 3 submissions per IP per time-vindue (in-memory `Map<string, number[]>` som i `/api/contact/route.ts` — IKKE Supabase count-check, der er race-condition-sårbart)

**Response:**
- 201: `{ success: true }`
- 400: `{ error: "..." }`

### `GET /api/admin/pending-shelter-submissions`

Returnerer pending submissions, nyeste først. Kræver admin-secret.

### `POST /api/admin/approve-shelter-submission`

Sætter status = 'approved', reviewed_at = now(). **Bruger `.eq("status", "pending")` i update-filter** som idempotency-guard mod dobbelt-behandling (samme mønster som `reject-community/route.ts` linje 46). Admin opretter selve shelter-rækken manuelt (eksisterende flow).

### `POST /api/admin/reject-shelter-submission`

Sætter status = 'rejected', gem `rejected_reason`. Bruger ligeledes `.eq("status", "pending")` som guard.

---

## Frontend-komponenter

### `RegistrerShelterPage` — `/registrer-shelter/page.tsx`

Server component (metadata) + client form component.

- Hero med gradient-banner og trust-bullets
- `<RegistrerShelterForm>` — client component med lokal state
- POST til `/api/submit-shelter` med `type: "owner_registration"`
- Success-state inline (ingen redirect)

### `ShelterTipModal` — `components/ShelterTipModal.tsx`

Client component. Kontrolleret af `isOpen`/`onClose` props.

- Backdrop + centered modal
- Tre felter: navn*, placering*, valgfri info
- POST til `/api/submit-shelter` med `type: "user_tip"`
- Success-state: "Tak — vi kigger på det!"
- **State management:** En `ShelterTipModalProvider` client-komponent wrappes i `app/(site)/layout.tsx` og eksponerer en `useShelterTipModal()` hook (React context). Navbar, footer og søgeside kalder `openModal()` fra denne hook. Dette undgår prop-drilling og er kompatibelt med Next.js 14 App Router server-layout.

### Header-integration — `components/Navbar.tsx`

Tilføj "💡 Mangler dit shelter?" knap (blå, desktop) og mobilmenu-link. Klikker åbner `ShelterTipModal`.

### Footer-integration — `components/Footer.tsx`

Tilføj link "Kend du et shelter der mangler?" i footer-linklisten.

### Søgeside-banner — `app/(site)/soeg/page.tsx` (eller client-komponent)

Banner under søgeresultater: "Mangler dit shelter? [Fortæl os om det →]"

### Admin-tab — `components/AdminPhotoReview.tsx`

Ny tab "Indsendte" med badge for pending count. Viser submissions med:
- Type-badge (grønt = ejer, blåt = bruger-tip)
- Navn, placering, kapacitet, faciliteter
- Kontaktinfo (ved owner_registration)
- "Godkend" / "Afvis" knapper
- Tekst-felt til afvisningsbegrundelse

---

## Ændrede filer

| Fil | Ændring |
|-----|---------|
| `web/migrations/20260419_shelter_submissions.sql` | **NY** — shelter_submissions tabel + constraints |
| `web/lib/shelter-submissions.ts` | **NY** — TypeScript interfaces og hjælpefunktioner |
| `web/app/api/submit-shelter/route.ts` | **NY** — POST endpoint, in-memory rate limiting |
| `web/app/api/admin/pending-shelter-submissions/route.ts` | **NY** — `export const dynamic = "force-dynamic"` |
| `web/app/api/admin/approve-shelter-submission/route.ts` | **NY** — `export const dynamic = "force-dynamic"` |
| `web/app/api/admin/reject-shelter-submission/route.ts` | **NY** — `export const dynamic = "force-dynamic"` |
| `web/app/(site)/registrer-shelter/page.tsx` | **NY** — Flow 1 landingsside |
| `web/components/ShelterTipModal.tsx` | **NY** — Flow 2 modal |
| `web/components/ShelterTipModalProvider.tsx` | **NY** — React context provider + `useShelterTipModal()` hook |
| `web/app/(site)/layout.tsx` | Wrap med `ShelterTipModalProvider` |
| `web/components/Navbar.tsx` | Tilføj modal-trigger knap via `useShelterTipModal()` |
| `web/components/Footer.tsx` | Tilføj link der kalder `openModal()` |
| `web/app/(site)/soeg/` | Tilføj "Mangler dit shelter?"-banner |
| `web/components/AdminPhotoReview.tsx` | Ny "Indsendte" tab med type-badges |

---

## Hvad der IKKE bygges nu

- Kortmarkering i formularen (tilføjes som v2)
- Billede-upload i Flow 1 (de kan kontakte admin med billeder)
- Email-notifikation til admin ved ny submission (tilføjes separat)
- Auto-oprettelse af shelter fra submission (admin gør det manuelt)
- Rate limiting via Redis eller Supabase-baseret count-check (bruger in-memory Map — se API-sektionen)

---

## Verifikation

1. `/registrer-shelter` loader korrekt med hero + formular
2. Indsend Flow 1 → POST succeeds → success-besked vises → row i `shelter_submissions` med type='owner_registration'
3. Header-knap åbner modal
4. Indsend Flow 2 → success-besked → row med type='user_tip'
5. Footer-link og søgeside-banner virker
6. Admin-panel: "Indsendte" tab viser pending submissions med korrekte badges
7. Admin godkender/afviser → status opdateres
8. Validering: navn og email krævet i Flow 1, navn og placering i Flow 2
