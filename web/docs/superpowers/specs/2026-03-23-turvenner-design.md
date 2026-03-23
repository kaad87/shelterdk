# Find Turvenner — Design Spec

**Dato:** 2026-03-23
**Status:** Godkendt

## Formål

En dedikeret side (`/turvenner`) hvor brugere kan oprette opslag for at finde makkere til shelterture. Inspireret af community-feedback: folk booker shelters og vil gerne dele turen med andre.

## Krav

- Ingen login påkrævet (anonyme opslag, ligesom community-bidrag)
- Kontakt via skjult email-formular (afsenders email aldrig vist offentligt)
- Opslag vises med det samme efter basis spam-check
- Automatisk udløb efter turdato+1 dag, eller max 30 dage
- Simpelt UI: listevisning + opret-formular

## Datamodel

Ny `trip_posts` tabel i Supabase:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid (PK) | Auto-genereret |
| `slug` | text (unique) | URL-venligt ID |
| `author_name` | text | Opretterens navn (2-60 tegn) |
| `author_email` | text | Opretterens email (skjult, bruges til kontakt) |
| `title` | text | Overskrift (5-100 tegn) |
| `description` | text | Fritekst (10-500 tegn) |
| `trip_date` | date (nullable) | Planlagt turdato (valgfri) |
| `spots_available` | integer | Antal ledige pladser (1-10) |
| `region` | text | Region-filter (samme som ruteplanner) |
| `shelter_id` | uuid (nullable, FK) | Valgfri reference til specifikt shelter |
| `expires_at` | timestamptz | trip_date+1 dag, eller created_at+30 dage |
| `status` | text | "active" / "expired" / "removed" |
| `created_at` | timestamptz | Default now() |
| `ip_hash` | text | SHA-256 hash af IP (rate limiting) |

### RLS Policies
- `SELECT`: Alle kan læse aktive opslag (`status = 'active' AND expires_at > now()`)
- `INSERT`: Alle kan oprette (via API route med validering)
- `UPDATE/DELETE`: Kun service role (admin/cron)

## Sidestruktur

### URL
`/turvenner`

### Listevisning (default)
- Alle aktive opslag, nyeste først
- Filtrering på region (dropdown)
- Hvert opslag viser: titel, navn, turdato, antal pladser, region, beskrivelse (trunkeret)
- "Kontakt"-knap på hvert opslag
- "Opret opslag"-knap øverst

### Opret opslag
Modal eller panel med formular:
- Navn (påkrævet)
- Email (påkrævet, vises ikke offentligt)
- Titel (påkrævet)
- Beskrivelse (påkrævet)
- Turdato (valgfri)
- Antal ledige pladser (1-10, default 1)
- Region (dropdown)
- Shelter (valgfrit typeahead-felt)

### Kontaktformular
Modal der åbnes ved klik på "Kontakt":
- Navn (påkrævet)
- Email (påkrævet)
- Besked (påkrævet, max 1000 tegn)
- Send-knap

## Kontaktflow

1. Bruger klikker "Kontakt" på et opslag
2. Udfylder formular med navn, email, besked
3. API sender email til opretteren via Resend
4. Email indeholder afsenders navn, email og besked
5. Opretteren kan svare direkte til afsenders email

### Email-service
- **Resend** (gratis tier: 100 emails/dag, rigeligt til start)
- Afsender: `noreply@shelterdk.dk` (eller subdomain)
- Reply-To sat til kontaktpersonens email

## Spam-beskyttelse

1. **Honeypot-felt** — Skjult felt i formularen; bots udfylder det, rigtige brugere ser det ikke
2. **Rate limiting** — Max 3 opslag per IP-hash per dag (tjekkes i API route)
3. **Bandeords-/linkfilter** — Simpelt regex-filter mod åbenlyse spam-mønstre
4. **Rapportér-knap** — Brugere kan flage opslag; efter N flags markeres det til admin-review
5. **Admin-fjernelse** — Admin kan sætte status til "removed" via admin-panel

## Automatisk oprydning

- Ved hvert page load: API filtrerer på `expires_at > now()` (ingen cron nødvendig)
- Periodisk cleanup af gamle rækker kan gøres manuelt eller via scheduled task
- Opslag med `trip_date` udløber dagen efter turdatoen
- Opslag uden `trip_date` udløber 30 dage efter oprettelse

## API Routes

| Endpoint | Metode | Beskrivelse |
|----------|--------|-------------|
| `/api/turvenner` | GET | List aktive opslag (med region-filter) |
| `/api/turvenner` | POST | Opret nyt opslag |
| `/api/turvenner/[slug]/contact` | POST | Send kontakt-email til opretter |
| `/api/turvenner/[slug]/report` | POST | Rapportér opslag |

## UI/Styling

- Følger eksisterende shelterdk design: `#2C3E50` primary, `#C5A059` accent
- DM Sans + Playfair Display fonts
- Responsive: cards i grid på desktop, stacked på mobil
- Lucide-react ikoner (Calendar, Users, MapPin, Mail)

## Fremtidige udvidelser (ikke i v1)

- Knyt opslag til ruter (ikke kun shelters)
- Vis opslag på shelter-detaljesider
- Samlet oversigt med kort
- Brugerkonti med "mine opslag" og slet-funktion
- Push-notifikationer ved ny kontakt
