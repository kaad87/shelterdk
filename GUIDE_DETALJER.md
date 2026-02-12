# ShelterDK – detaljeret guide

Denne guide dækker opsætning, database, migrationer, backfills, web-app og fejlfinding.

---

## 1. Miljø og Supabase

### 1.1 Opret .env

I projektroden (`shelterdk/`) opret **`.env`** (eller kopiér fra `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://dit-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-key

# Valgfrit: Google Places (rating, anmeldelser, billeder)
# GOOGLE_MAPS_API_KEY=din-google-api-key
```

Hent **Project URL** og **anon public** key fra Supabase Dashboard → **Settings → API**.

### 1.2 Web-app env

Web-appen (`web/`) læser de samme variabler. Du kan have **`web/.env.local`** med samme indhold, eller lade den arve fra roden. Next.js prioriterer `.env.local` i `web/`.

---

## 2. Database: schema og migrationer

### 2.1 Grundtabel

I **Supabase Dashboard → SQL Editor** kør først:

- **`schema.sql`** – opretter `shelters` med kolonner som `title`, `slug`, `location`, `geofa_raw`, `image_url`, `image_urls`, `booking_url`, RLS og policies.

### 2.2 Migrationer (i rækkefølge)

Kør **én fil ad gangen** i SQL Editor i denne rækkefølge:

| # | Fil | Beskrivelse |
|---|-----|-------------|
| 001 | `migrations/001_add_geofa_raw_and_image_url.sql` | Sikrer `geofa_raw`, `image_url`, `image_urls` (kan allerede være i schema). |
| 002 | `migrations/002_bookenshelter_raw.sql` | Tabel til Book en Shelter-raw data. |
| 003 | `migrations/003_naturstyrelsen_raw.sql` | Tabel til Naturstyrelsen-raw data. |
| 004 | `migrations/004_google_places.sql` | Tabel `google_places` (place_id, navn, koordinater, photo_references). |
| 005 | `migrations/005_google_place_reviews.sql` | Tabel `google_place_reviews` (anmeldelser). |
| 006 | `migrations/006_shelter_dedupe.sql` | Kolonne `duplicate_of_shelter_id` til deduplering. |
| 007 | `migrations/007_google_place_name.sql` | Kolonner `google_place_id`, `google_place_name` på `shelters`. |
| 008 | `migrations/008_kommune.sql` | Kolonne `kommune` på `shelters`. |
| 009 | `migrations/009_kommune_remove_codes.sql` | Fjerner kommunekoder (tal) fra visning. |
| 010 | `migrations/010_title_remove_book_en_shelter.sql` | Fjerner præfiks "Book en Shelter: " fra titler. |
| 011 | `migrations/011_remove_cookiebot_image_urls.sql` | Sætter `image_url`/`image_urls` til NULL hvor Cookiebot/1.gif. |
| 012 | `migrations/012_remove_invalid_image_urls.sql` | Sætter `image_url` til NULL hvor værdien er HTML eller ikke http(s)-URL. |

Efter 008 har du `kommune`; efter 012 er ugyldige billed-URL’er (fx `<a>Link</a>`) ryddet op.

### 2.3 Ugyldige billeder (invalid pictures)

Nogle rækker har i **`image_url`** eller **`image_urls`** værdier der ikke er rigtige billed-URL’er, fx:

- **HTML** som `<a>Link</a>` (fra kilden)
- **Cookiebot**- eller **1.gif**-URL’er (sporing/placeholder)
- Tomme strenge eller ikke-http(s)-URL’er

**Hvad appen gør:**

- **`isValidImageUrl()`** (i `web/lib/shelter-detail.ts`) accepterer kun strenge der starter med `http://` eller `https://`, ikke indeholder `<`/`>`, og har rimelig længde.
- **`getPhotoUrls()`** bruger kun URL’er der består denne check – for både **`image_url`**, **`image_urls`** (jsonb) og geofa-foto. Ugyldige indgange vises derfor ikke i galleriet.
- **ShelterCard** og forside: hvis `image_url` ikke er gyldig, vises **placeholder** i stedet for at prøve at loade URL’en som billede.

**Oprydning i databasen:**

- **Migration 011** sætter `image_url`/`image_urls` til NULL hvor værdien er Cookiebot eller 1.gif.
- **Migration 012** sætter `image_url` til NULL hvor værdien ikke starter med `http://`/`https://` eller indeholder `<`/`>` (fx HTML som `<a>Link</a>`).

Efter at 011 og 012 er kørt, vil disse rækker ikke længere tælle som "med billede" i søgesortering, og brugeren ser placeholder i stedet for brudte eller mærkelige "billeder". **`image_urls`** (jsonb) ryddes ikke direkte i migrationerne; hver enkelt URL i arrayet filtreres i appen via **`getPhotoUrls`** og **`isValidImageUrl`**.

---

## 3. Import og eksterne kilder

### 3.1 GeoFA (kerne-data)

```bash
python3 import_shelters.py
```

- Henter fra GeoFA WFS (eller lokal **`geofa_shelters.geojson`** hvis du sætter `GEOFA_GEOJSON_FILE`).
- Filtrerer på facilitetstyper: Shelter, Bålhytte, Teltplads, Bålplads.
- Opretter/opdaterer rækker i `shelters` med `title`, `slug`, `location`, `geofa_raw`, `image_url`/`image_urls` fra GeoFA, og søger efter **udinaturen.dk**-links til `booking_url`.

Ved 500 fra GeoFA: brug lokal GeoJSON (se README) eller sæt `GEOFA_GEOJSON_FILE=/sti/til/fil.geojson`.

### 3.2 Book en Shelter (booking-URL’er)

1. Opret **`bookenshelter_urls.txt`** med én URL per linje (shelter-sider fra bookenshelter.dk).
2. Kør:
   ```bash
   python3 fetch_bookenshelter_from_urls.py
   python3 match_bookenshelter_to_shelters.py
   ```
   Match sætter **booking_url** på shelters inden for ca. 350 m.

### 3.3 Naturstyrelsen (booking-URL’er)

1. Opret **`naturstyrelsen_urls.txt`** med links til steder på book.naturstyrelsen.dk.
2. Kør:
   ```bash
   python3 fetch_naturstyrelsen_from_urls.py
   python3 match_naturstyrelsen_to_shelters.py
   ```

---

## 4. Backfills (berigelse af eksisterende data)

Disse script kræver **`.env`** med Supabase URL og anon key. Kør fra projektroden.

### 4.1 Kommune fra koordinater

Udfylder **`kommune`** for shelters uden, via Nominatim (reverse geocoding).

```bash
python3 backfill_kommune_from_geo.py [--dry-run]
# Konverter kommune-navne til by-navne i DB:
python3 backfill_kommune_from_geo.py --convert-to-by [--dry-run]
```

### 4.2 Region (Jylland, Sjælland, Fyn, Øerne)

Sætter **`region`** ud fra **`kommune`** så "Udforsk efter region" og søg-filtrering virker.

```bash
python3 backfill_region_from_kommune.py [--dry-run]
```

### 4.3 Booking-URL fra GeoFA

Finder **udinaturen.dk**-links i **`geofa_raw`** og sætter **`booking_url`** hvor den mangler.

```bash
python3 backfill_booking_url_from_geofa.py [--dry-run]
```

### 4.4 Billede fra Google Places

Udfylder **`image_url`** fra Google Place Photo API hvor **`google_places.photo_references`** findes (kræver **`GOOGLE_MAPS_API_KEY`** i .env).

```bash
python3 backfill_image_from_google_places.py [--dry-run]
python3 backfill_image_from_google_places.py --force   # overskriv også eksisterende
```

### 4.5 Ryd 404-billeder (clear invalid image URLs)

Hvis mange **`image_url`** i DB returnerer 404, kan du sætte dem til NULL så placeholder vises, og evt. efterfølgende køre Google-backfill (4.4).

```bash
python3 clear_404_image_urls.py [--dry-run] [--limit 2000]
```

- Tjekker hver `image_url` med HEAD/GET; ved 404 eller anden fejl sættes **`image_url`** til NULL.
- **`--limit N`**: tjek max N shelters (default 2000, `0` = alle).
- **`--dry-run`**: vis kun hvad der ville blive opdateret.

---

## 5. Google Places (rating, anmeldelser, billeder)

1. Opret API-nøgle i Google Cloud Console, aktiver **Places API** (og evt. Maps), sæt den i `.env` som **`GOOGLE_MAPS_API_KEY`**.
2. Hent steder og gem i **`google_places`** og opdater **`shelters`** (place_id, navn):
   ```bash
   python3 fetch_google_places.py
   ```
3. Anmeldelser hentes til **`google_place_reviews`** (bruges af web-appen når `google_place_id` matcher).
4. Billeder: brug **`backfill_image_from_google_places.py`** (se 4.4).

Se evt. **`GUIDE_GOOGLE_PLACES.md`** for flere detaljer.

---

## 6. Web-app (Next.js)

### 6.1 Installer og kør

```bash
cd web
npm install
npm run dev          # http://localhost:3000
# eller
npm run dev:3002     # http://127.0.0.1:3002
```

Port allerede i brug:

```bash
lsof -ti :3002 | xargs kill -9
cd web && npm run dev:3002
```

### 6.2 Miljø

Web-appen bruger **`NEXT_PUBLIC_SUPABASE_URL`** og **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (fra `web/.env.local` eller roden `.env`). Ingen build nødvendig for at skifte miljø – genstart dev-server.

### 6.3 Build til produktion

```bash
cd web
npm run build
npm start
```

---

## 7. App-funktioner (kort over kode)

- **Forside:** Shelters med både billede (fra tillidte domæner) og anmeldelser; Cookiebot/1.gif og ugyldige `image_url` (fx HTML) vises ikke. Se **`web/app/page.tsx`** og **`FrontPageShelterGrid`**.
- **Søg (/soeg):** Paginering + infinite scroll; filtrering på **region** og **q** (by/område); by-forslag (autocomplete) fra **`/api/soeg/byer`**; sortering: først med billede, så med anmeldelser. Kortvisning henter op til 1000 første gang og loader derefter resten. Se **`web/lib/soeg-db.ts`**, **`web/app/api/soeg/`**, **`SoegContent`**.
- **Shelter-detail:** Beskrivelse, faciliteter, booking-link (eller link til udinaturen.dk), kort (Leaflet), **image_url** + **image_urls** + geofa-foto; kun gyldige http(s)-URL’er (ingen HTML). Se **`web/app/shelter/[slug]/page.tsx`**, **`getPhotoUrls`** og **`isValidImageUrl`** i **`web/lib/shelter-detail.ts`**.
- **Billeder:** **`image_url`** (enkelt) og **`image_urls`** (jsonb-array) bruges begge; alle URL’er valideres med **`isValidImageUrl`** (http(s), ingen `<`/`>`). Migration 012 rydder ugyldige `image_url` i DB.

---

## 8. Fejlfinding

- **"Could not find the table 'public.shelters'"** – Kør **`schema.sql`** i Supabase SQL Editor.
- **Manglende kolonne (42703)** – Kør den manglende migration (001–012) i rækkefølge.
- **Kort viser få shelters** – Ved kortvisning hentes nu op til 1000 og derefter resten; tjek at **`region`** er udfyldt (kør **`backfill_region_from_kommune.py`**).
- **Ingen by-forslag i søg** – Tjek at **`/api/soeg/byer`** kører (genstart dev-server) og at **`kommune`** er udfyldt i DB.
- **Billede vises som HTML/placeholder** – **`isValidImageUrl`** filtrerer ugyldige værdier; kør migration **012** for at sætte `image_url` til NULL hvor værdien er HTML eller ikke-URL.
- **GeoFA 500** – Brug lokal GeoJSON eller se README under "Manuel download af GeoJSON".

---

## Hurtig reference: kommandoer

| Formål | Kommando |
|--------|----------|
| Import GeoFA | `python3 import_shelters.py` |
| Kommune fra koordinater | `python3 backfill_kommune_from_geo.py` |
| Region fra kommune | `python3 backfill_region_from_kommune.py` |
| Booking-URL fra GeoFA | `python3 backfill_booking_url_from_geofa.py` |
| Billede fra Google | `python3 backfill_image_from_google_places.py` |
| Ryd 404 image_url | `python3 clear_404_image_urls.py [--dry-run]` |
| Web-app (port 3002) | `cd web && npm run dev:3002` |
