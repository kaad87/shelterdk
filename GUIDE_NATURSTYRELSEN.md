# Guide: Få Naturstyrelsen ind i databasen

Kun de trin der skal til for at hente data fra book.naturstyrelsen.dk og gemme det i Supabase.

---

## 1. Opret tabellen (én gang)

Du skal køre et stykke SQL i Supabase, så tabellen **`naturstyrelsen_raw`** bliver oprettet. Gør sådan her:

### 1a. Åbn Supabase og SQL Editor

1. Gå til [supabase.com](https://supabase.com) og log ind.
2. Vælg dit projekt (eller opret et nyt).
3. I venstre menu: klik på **SQL Editor** (ikon med `</>` eller teksten "SQL Editor").

### 1b. Opret en ny forespørgsel

4. Klik på **New query** (eller "New" / "+ New query"), så du får et tomt felt til SQL.

### 1c. Indsæt SQL-koden

5. Åbn på din computer filen **`migrations/003_naturstyrelsen_raw.sql`** (i din `shelterdk`-mappe under `migrations/`).
6. Vælg **alt** i filen (Ctrl+A / Cmd+A) og kopiér (Ctrl+C / Cmd+C).
7. Gå tilbage til Supabase SQL Editor og indsæt (Ctrl+V / Cmd+V) i det store tekstfelt.

Du bør nu se noget i stil med:

```sql
-- Kør i Supabase → SQL Editor (én gang).
create table if not exists public.naturstyrelsen_raw (
  id uuid primary key default gen_random_uuid(),
  ...
);
...
```

### 1d. Kør SQL’en

8. Klik på **Run** (eller "Run" nederst til højre / tryk Ctrl+Enter).
9. Tjek resultatet: Der bør stå noget som "Success. No rows returned" eller lignende. Hvis der står en fejl, tjek at du har kopieret hele filen og at du har rettigheder i projektet.

### 1e. Tjek at tabellen findes

10. I venstre menu: klik på **Table Editor**.
11. I listen over tabeller bør du nu se **`naturstyrelsen_raw`**. Klik på den – tabellen er tom, det er forventet. Den bliver fyldt når du kører hentescriptet i trin 5.

Så er trin 1 færdig. Tabellen **`naturstyrelsen_raw`** er oprettet og klar til data.

---

## 2. URLs findes automatisk (ingen manuel indtastning)

Scriptet **finder selv** alle shelter/sted-URLs ved at åbne Naturstyrelsens søgeside i en browser (Playwright) og udtrække links. Du behøver ikke samle URLs manuelt.

### 2a. Installer Playwright (én gang)

I terminalen, fra mappen `shelterdk/`:

```bash
pip3 install playwright
python3 -m playwright install chromium
```

Uden dette kan scriptet ikke finde URLs automatisk (se 2c som fallback).

### 2b. Hvad der sker, når du kører fetch

Når du kører **python3 fetch_naturstyrelsen_from_urls.py** (trin 5):

- Hvis filen **naturstyrelsen_urls.txt** mangler eller er tom, kører scriptet først **discover_naturstyrelsen_urls.py** for dig.
- Discovery åbner book.naturstyrelsen.dk/soeg/ i Chromium, venter på at listen indlæses, og udtrækker alle links der peger på `/sted/...`.
- De fundne URLs gemmes i **naturstyrelsen_urls.txt**, og derefter hentes hver side og gemmes i databasen.

Du kan også køre discovery alene (uden at hente hver side), hvis du kun vil opdatere URL-listen:

```bash
python3 discover_naturstyrelsen_urls.py
```

### 2c. Hvis automatisk discovery ikke virker

Hvis Playwright ikke finder nogen URLs (fx fordi siden har ændret sig eller kræver login):

- Opret manuelt filen **naturstyrelsen_urls.txt** med én URL per linje.
- Find links fx via Google: **site:book.naturstyrelsen.dk/sted/** – åbn enkeltsider og kopiér adressefeltets URL ind i filen.
- Når filen indeholder mindst én gyldig URL, springer fetch-scriptet discovery over og bruger kun filen.

---

## 3. URL-fil (valgfrit)

Hvis du har kørt fetch-scriptet mindst én gang med success, ligger **naturstyrelsen_urls.txt** allerede i `shelterdk/` med de fundne URLs. Du kan redigere filen for at tilføje eller fjerne URLs (én per linje). Linjer der starter med `#` og tomme linjer ignoreres.

---

## 4. Sæt Supabase-oplysninger

Sørg for at filen **`.env`** i `shelterdk/` indeholder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dit-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-key
```

Uden disse gemmes data kun lokalt (GeoJSON/JSON), ikke i databasen.

---

## 5. Kør hentescriptet

I terminalen, fra mappen **`shelterdk/`**:

```bash
python3 fetch_naturstyrelsen_from_urls.py
```

Scriptet:

- Henter hver URL fra `naturstyrelsen_urls.txt`
- Udtrækker titel, beskrivelse og adresse fra siden
- Geocoder adressen (via Nominatim) hvis der ikke er koordinater i siden
- Gemmer i **`naturstyrelsen_raw`** i Supabase (kun steder med koordinater)
- Gemmer desuden **`naturstyrelsen_shelters.geojson`** og **`naturstyrelsen_scraped.json`** lokalt

---

## 6. Tjek i databasen

I Supabase: **Table Editor → naturstyrelsen_raw**.

Her bør der nu være én række per URL der havde en adresse/koordinater. Rækker uden koordinater (og som ikke kunne geocodes) ligger kun i **`naturstyrelsen_scraped.json`**.

---

## Oversigt

| Trin | Handling |
|------|----------|
| 1 | Kør `migrations/003_naturstyrelsen_raw.sql` i Supabase |
| 2 | Installér Playwright (én gang): `pip3 install playwright` og `python3 -m playwright install chromium` |
| 3 | (Valgfrit) Redigér `naturstyrelsen_urls.txt` hvis du vil tilføje/fjerne URLs – ellers findes de automatisk |
| 4 | Sæt `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `.env` |
| 5 | Kør `python3 fetch_naturstyrelsen_from_urls.py` (finder URLs automatisk, henter sider, gemmer i DB) |
| 6 | Tjek tabellen `naturstyrelsen_raw` i Supabase |

Efterfølgende kan du køre **`python3 match_naturstyrelsen_to_shelters.py`** for at knytte disse steder til dine GeoFA-shelters og sætte **booking_url**.
