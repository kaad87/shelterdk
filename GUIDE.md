# ShelterDK – trin-for-trin guide

Følg trinene i rækkefølge. Du kan stoppe efter trin 3 hvis du kun vil have GeoFA-shelters; trin 4–7 tilføjer booking-links fra Book en Shelter og Naturstyrelsen.

---

## Trin 1: Supabase og .env

1. Opret et projekt på [supabase.com](https://supabase.com) (eller brug eksisterende).
2. I projektet: **Settings → API** – kopiér **Project URL** og **anon public** key.
3. I mappen `shelterdk/`: opret filen **`.env`** (eller kopiér fra `.env.example`) og sæt:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://dit-projekt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-key-her
   ```

---

## Trin 2: Tabeller i Supabase

Åbn **Supabase Dashboard → SQL Editor** og kør disse filer **én ad gangen** i nedenstående rækkefølge:

1. **`schema.sql`** – opretter `shelters` (grundtabel).
2. **`migrations/001_add_geofa_raw_and_image_url.sql`** – hvis du har den (ekstra kolonner til GeoFA/billeder).
3. **`migrations/002_bookenshelter_raw.sql`** – hvis du vil bruge Book en Shelter.
4. **`migrations/003_naturstyrelsen_raw.sql`** – hvis du vil bruge Naturstyrelsen.

Kopiér indholdet af hver fil ind i SQL Editor og tryk **Run**.

---

## Trin 3: Importer shelters fra GeoFA

I terminalen, fra mappen `shelterdk/`:

```bash
python3 import_shelters.py
```

- Hvis GeoFA svarer: shelters hentes automatisk og indsættes i `shelters`.
- Hvis du får **500** eller fejl: brug lokal GeoJSON (se README under "Manuel download af GeoJSON") og kør igen:
  ```bash
  python3 import_shelters.py
  ```

Tjek i Supabase **Table Editor → shelters** at der er rækker.

---

## Trin 4 (valgfrit): Book en Shelter – data ind

Kun nødvendigt hvis du vil have booking-URLs fra bookenshelter.dk.

1. **Én gang:** Du har allerede kørt migration **002** (trin 2).
2. **Find URLs:** Søg i Google: **site:bookenshelter.dk shelterplads** – åbn resultater og kopiér links til enkelte shelter-sider.
3. **Opret fil:** `bookenshelter_urls.txt` i mappen `shelterdk/` med **én URL per linje**. Se `bookenshelter_urls.txt.example`.
4. **Kør (lokal maskine anbefales):**
   ```bash
   python3 fetch_bookenshelter_from_urls.py
   ```
   Alternativt kan du prøve sitemap: `python3 fetch_bookenshelter_sitemap.py`.

Output: `bookenshelter_shelters.geojson` + data i `bookenshelter_raw` i Supabase.

---

## Trin 5 (valgfrit): Book en Shelter – match mod shelters

Kør efter trin 4:

```bash
python3 match_bookenshelter_to_shelters.py
```

Dette sætter **booking_url** på de shelters, der matcher et Book en Shelter-punkt (inden for ca. 350 m).

---

## Trin 6 (valgfrit): Naturstyrelsen – data ind

Kun nødvendigt hvis du vil have booking-URLs fra book.naturstyrelsen.dk.

1. **Én gang:** Du har kørt migration **003** (trin 2).
2. **Find URLs:** Søg fx: **site:book.naturstyrelsen.dk/sted/** – kopiér links til enkelte steder/shelters.
3. **Opret fil:** `naturstyrelsen_urls.txt` i mappen `shelterdk/` med **én URL per linje**. Se `naturstyrelsen_urls.txt.example`.
4. **Kør:**
   ```bash
   python3 fetch_naturstyrelsen_from_urls.py
   ```

Output: `naturstyrelsen_shelters.geojson` + data i `naturstyrelsen_raw`. Adresser i teksten geocodes automatisk så steder får koordinater hvor muligt.

---

## Trin 7 (valgfrit): Naturstyrelsen – match mod shelters

Kør efter trin 6:

```bash
python3 match_naturstyrelsen_to_shelters.py
```

Sætter **booking_url** på shelters der matcher et Naturstyrelsen-punkt (inden for ca. 350 m), **kun** hvor der ikke allerede er en booking_url (fx fra Book en Shelter).

---

## Hurtig oversigt

| Trin | Hvad | Kommando / handling |
|------|------|----------------------|
| 1 | Supabase + .env | Opret .env med URL og anon key |
| 2 | Tabeller | Kør schema.sql + migrations 001, 002, 003 i SQL Editor |
| 3 | GeoFA-shelters | `python3 import_shelters.py` |
| 4 | Book en Shelter data | Opret bookenshelter_urls.txt → `python3 fetch_bookenshelter_from_urls.py` |
| 5 | Book en Shelter match | `python3 match_bookenshelter_to_shelters.py` |
| 6 | Naturstyrelsen data | Opret naturstyrelsen_urls.txt → `python3 fetch_naturstyrelsen_from_urls.py` |
| 7 | Naturstyrelsen match | `python3 match_naturstyrelsen_to_shelters.py` |

Efter trin 3 har du shelters i databasen. Efter 5 og 7 har mange af dem også **booking_url** fra Book en Shelter og/eller Naturstyrelsen.
