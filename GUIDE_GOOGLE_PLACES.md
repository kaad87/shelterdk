# Guide: Google Places – rating, anmeldelser og billeder til shelters

Trin-for-trin: få oprettet tabellerne, hentet en API-nøgle, kørt scriptet – og brugt data til rating, billeder, anmeldelser og deduplicering.

---

## Trin 1. Opret tabeller i Supabase (én gang)

Uden disse tabeller kan scriptet ikke gemme data. Du kører ét stykke SQL i Supabase.

### 1a. Åbn Supabase og SQL Editor

1. Gå til [supabase.com](https://supabase.com) og log ind.
2. Vælg dit **shelterdk**-projekt.
3. I venstre menu: klik på **SQL Editor** (ikon `</>` eller "SQL Editor").

### 1b. Ny forespørgsel og indsæt migrationen

4. Klik **New query**, så du får et tomt SQL-felt.
5. Åbn på din computer **`migrations/004_google_places.sql`** (i mappen `shelterdk/migrations/`).
6. Vælg alt i filen (Cmd+A) og kopiér (Cmd+C).
7. Indsæt i SQL Editor (Cmd+V).

Du bør se SQL der opretter `google_places`, `shelter_google_match` og tilføjer kolonner til `shelters`.

### 1c. Kør SQL’en

8. Klik **Run** (eller Ctrl+Enter).
9. Tjek: Der bør stå **"Success. No rows returned"** eller lignende. Hvis du får fejl om "shelters does not exist", har du ikke kørt `schema.sql` først – opret først `shelters`-tabellen.

### 1d. Tjek at alt findes

10. Gå til **Table Editor**.
11. Du bør nu se tabellerne **`google_places`** og **`shelter_google_match`** (begge tomme).
12. Klik på **`shelters`** og scroll til højre: der bør være kolonnerne **`google_place_id`**, **`google_rating`**, **`google_user_ratings_total`** (alle tomme indtil scriptet har kørt).

Trin 1 er færdig når disse tabeller og kolonner findes.

---

## Trin 2. Få en Google Places API-nøgle

Scriptet kalder Google’s API; du skal have en API-nøgle og slå Places API til.

### 2a. Google Cloud-projekt

1. Gå til [Google Cloud Console](https://console.cloud.google.com/).
2. Log ind med din Google-konto.
3. Øverst: vælg et **projekt** fra dropdown, eller klik **Select a project** → **New Project** → giv det et navn (fx "shelterdk") → **Create**.

### 2b. Slå Places API til

4. I venstre menu: **APIs & Services** → **Library** (eller søg efter "Library").
5. I søgefeltet skriv **Places API**.
6. Klik på **Places API** (den med "Places API" som titel, ikke "Places API (New)" medmindre du vil bruge den nye).
7. Klik **Enable**. Når den er aktiveret, ser du en "Manage"‑knap.

### 2c. Opret API-nøgle

8. Gå til **APIs & Services** → **Credentials**.
9. Klik **+ Create Credentials** → **API key**.
10. Nøglen vises i en popup. Du kan **Copy** den. (Valgfrit: "Restrict key" og vælg kun "Places API" under "API restrictions" – så begrænser du brugen til netop denne API.)
11. Luk popup’en. Nøglen ligger nu under **Credentials** og kan genbruges.

### 2d. Sæt nøglen i .env

12. På din computer: åbn **`shelterdk/.env`** (eller opret filen ved at kopiere `.env.example`).
13. Tilføj én linje (brug din egen nøgle):

   ```
   GOOGLE_MAPS_API_KEY=AIza...din-lange-nøgle...
   ```

14. Gem filen. **Vigtigt:** `.env` må ikke lægges i git (den bør allerede stå i `.gitignore`).

Du er klar når `GOOGLE_MAPS_API_KEY` står i `.env` og Places API er slået til i Cloud Console.

---

## Trin 3. Kør fetch-scriptet

Scriptet henter for hver shelter med koordinater: finder nærmeste Google Place ("shelter" i nærheden), henter rating og antal anmeldelser, og gemmer match + opdaterer shelters.

### 3a. Terminal og mappe

1. Åbn en terminal.
2. Gå til projektmappen:  
   `cd /sti/til/shelterdk`  
   (fx `cd ~/shelterdk` eller hvor du har repo’et).

### 3b. Afhængigheder

3. Du skal have **requests** og **supabase** (samme som resten af projektet):

   ```bash
   pip3 install requests supabase
   ```

### 3c. Første kørsel

4. Kør:

   ```bash
   python3 fetch_google_places.py
   ```

5. **Hvad der sker:**  
   - Scriptet læser alle shelters med et gyldigt `location` (POINT med koordinater).  
   - For hver shelter: kalder Google **Nearby Search** (radius 250 m, keyword "shelter"), vælger den bedste kandidat ud fra navn + afstand, kalder **Place Details**, gemmer i `google_places` og `shelter_google_match`, opdaterer `shelters` med `google_place_id`, `google_rating`, `google_user_ratings_total`.  
   - Der er ca. 1 sekund mellem hvert API-kald (rate limit).

6. I terminalen ser du løbende antal (fx "10/500 – 8 matchet"). Når det er færdigt, står der noget som:  
   **"Færdig. X shelters matchet, Y Google Places opdateret, Z fejl."**

### 3d. Hvis noget går galt

- **"Mangler GOOGLE_MAPS_API_KEY"** → Tjek at `.env` indeholder `GOOGLE_MAPS_API_KEY=...` og at du kører scriptet fra mappen hvor `.env` ligger.
- **"Mangler NEXT_PUBLIC_SUPABASE_URL"** → Samme `.env` skal have Supabase URL og anon key (som ved de andre scripts).
- **"REQUEST_DENIED"** eller **"API not enabled"** → I Cloud Console: tjek at **Places API** er Enable under APIs & Services → Enabled APIs.
- **"Ingen shelters at matche"** → Enten har ingen shelters koordinater i `location`, eller alle har allerede `google_place_id`. Prøv `--refresh` for at genhente (se nedenfor).

### 3e. Genhent alle (overskriv eksisterende match)

Hvis du vil køre scriptet igen og overskrive alle eksisterende Google-matches:

```bash
python3 fetch_google_places.py --refresh
```

Uden `--refresh` springer scriptet over shelters der allerede har `google_place_id` sat.

---

## Trin 4. Tjek resultaterne i Supabase

Efter scriptet er kørt kan du se data direkte i Supabase.

### 4a. Shelters med rating

1. **Table Editor** → **shelters**.
2. Filtrer eller sorter efter **google_rating** (fx "is not null"). Du bør se shelters med tal (fx 4.2) og **google_user_ratings_total** (fx 12).
3. **google_place_id** er en lang streng (fx `ChIJ...`) – det er Google’s unikke id for stedet.

### 4b. Match-tabellen

4. Åbn tabellen **shelter_google_match**.
5. Her ser du for hver række: **shelter_id**, **google_place_id**, **match_score** (0–1), **distance_meters**, **auto_matched** (true/false).  
   - Høj `match_score` og lav `distance_meters` = god match.  
   - `auto_matched = true` betyder at scriptet vurderede match som tillidsværdig (score ≥ 0,55 og afstand ≤ 300 m).

### 4c. Google Places (fulde detaljer)

6. Åbn **google_places**.
7. Her ligger **rating**, **user_ratings_total**, **photo_references** (JSON-array med strenge), og **raw_json** (hele Place Details-svaret).  
   - **raw_json** indeholder bl.a. **reviews**: forfatter, rating, tekst og tid for de seneste anmeldelser.

Nu har du rating og antal anmeldelser på shelters og kan bruge dem i UI eller videre scripts.

---

## Trin 5. Næste skridt: billeder

Billeder kommer ikke som færdige URL’er, men som **photo_reference**-strenge i `google_places.photo_references`. For at vise et billede skal du kalde Google’s **Places Photo API** med den reference.

### 5a. URL-format

Google’s Photo API returnerer selve billedet. URL-formatet er:

```
https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=REF&key=DIN_API_NØGLE
```

Erstat `REF` med én af strengene fra `google_places.photo_references` (fx første element i arrayet) og `DIN_API_NØGLE` med `GOOGLE_MAPS_API_KEY`.

### 5b. I dit frontend eller API

- **Frontend:** Hvis du har en backend der kan kalde Google, kan backend’en hente photo_reference fra DB, bygge URL’en med jeres API-nøgle, og enten **redirecte** til Google’s URL eller **proxye** billedet (så nøglen ikke eksponeres i browseren).
- **Alternativ:** Et script kan downloade billeder fra Photo API og uploade til Supabase Storage (eller anden lagring), og gemme den endelige billed-URL på shelter eller i en billed-tabel. Så behøver brugeren ikke kalde Google ved hver visning.

I `google_places.raw_json` kan du også finde **photos[].html_attributions** – Google kræver at du viser attribution når du viser deres billeder.

---

## Trin 6. Næste skridt: anmeldelser

De seneste anmeldelser ligger i **google_places.raw_json** under nøglen **reviews**.

### 6a. Struktur

Hver anmeldelse har typisk:

- **author_name**
- **rating** (1–5)
- **text**
- **relative_time_description** (fx "2 months ago")
- **time** (Unix-tid)

### 6b. Hvordan du bruger dem

- **I appen:** Hent for et shelter: join til `google_places` via `shelters.google_place_id`, læs `raw_json->'reviews'` og vis fx de 3 seneste (forfatter, rating, tekst, tid).
- **SQL-eksempel** (i Supabase SQL Editor) for at se anmeldelser for et shelter:

  ```sql
  select s.title, s.google_rating, s.google_user_ratings_total,
         gp.raw_json->'reviews' as reviews
  from shelters s
  join google_places gp on gp.google_place_id = s.google_place_id
  where s.google_place_id is not null
  limit 5;
  ```

Google returnerer typisk op til 5 anmeldelser per Place Details-kald; det er det du har gemt i `raw_json`.

---

## Trin 7. Næste skridt: deduplicering

Shelters med **samme** `google_place_id` er med stor sandsynlighed **samme fysiske sted** (fx samme shelter fra GeoFA, Naturstyrelsen og Book en Shelter). Du kan bruge det til at rydde dubletter op.

### 7a. Find grupper med samme Google Place

Kør i SQL Editor:

```sql
select google_place_id, count(*) as antal_shelters
from shelters
where google_place_id is not null
group by google_place_id
having count(*) > 1
order by antal_shelters desc;
```

Det giver dig alle `google_place_id`’er der er knyttet til mere end én shelter – kandidater til dedupe.

### 7b. Beslut strategi

- **Primær række:** For hver gruppe vælg én shelter som "primær" (fx den med mest komplet data: booking_url, image_url, bedste titel).
- **Markér dubletter:** Enten ved at tilføje en kolonne på `shelters`, fx **duplicate_of_shelter_id** (UUID der peger på den primære), eller ved en separat tabel **shelter_duplicates** (shelter_id, duplicate_of_shelter_id).
- **Visning:** I dit UI kan du filtrere ud hvor `duplicate_of_shelter_id is not null`, så brugeren kun ser én række per sted – eller vise "samme sted" og linke til den primære.

### 7c. Automatisk dedupe-script (valgfrit)

Et separat Python-script kan:

1. Hente alle shelters med `google_place_id` ikke null.
2. Gruppere efter `google_place_id`.
3. For hver gruppe med mere end én: vælge primær (fx efter prioriteret kilde eller antal felter udfyldt), sætte **duplicate_of_shelter_id** på de øvrige.
4. Evt. kun køre som "dry run" og printe hvad den ville gøre, før du tilføjer kolonnen og kører for alvor.

Det kræver en lille migration der tilføjer `duplicate_of_shelter_id` til `shelters` (eller opretter dedupe-tabellen), og derefter scriptet. Hvis du vil have det skrevet, sig til.

---

## Oversigt: rækkefølge

| Rækkefølge | Handling |
|------------|----------|
| 1 | Kør **004_google_places.sql** i Supabase SQL Editor. |
| 2 | Opret Google API-nøgle, slå Places API til, sæt **GOOGLE_MAPS_API_KEY** i `.env`. |
| 3 | Kør **python3 fetch_google_places.py** fra `shelterdk/`. |
| 4 | Tjek **shelters**, **shelter_google_match** og **google_places** i Table Editor. |
| 5 | Brug **google_rating** / **google_user_ratings_total** i UI; hent billeder via Photo API og anmeldelser fra **raw_json.reviews**. |
| 6 | Deduplicer ved at gruppere på **google_place_id** og markere dubletter (fx **duplicate_of_shelter_id**). |

Når du er her, har du rating, antal anmeldelser og mulighed for billeder og dedupe. Hvis du vil have et konkret dedupe-script eller hjælp til at bygge Photo-URL’er i koden, sig hvilken del du vil dykke ned i.
