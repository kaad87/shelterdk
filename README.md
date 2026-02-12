# ShelterDK – import fra GeoFA

Importer shelters (sheltere) til Supabase fra GeoFA (Geografiske Fagdata).

## Hurtig start

1. **Opret tabellen i Supabase:** Åbn Supabase Dashboard → SQL Editor, indsæt indholdet af `schema.sql`, og kør det. (Uden denne tabel får du fejlen "Could not find the table 'public.shelters'".)
2. Sæt Supabase URL og nøgle i `shelterdk/.env` (se `.env.example`).
3. Kør: `python3 import_shelters.py`

## Hvad importeres?

GeoFA laget "Facilitet punkt" (`t_5800_fac_pkt`) indeholder **alle** slags faciliteter (shelter, bålpladser, toiletter, parkering, museer osv.). Import-scriptet filtrerer på feltet **`facil_ty`** og importerer kun:

- **Shelter**, **Bålhytte**, **Teltplads**, **Bålplads**

Titler hentes fra **`navn`**; mangler den, bruges fx "Shelter, [kommune]" eller "Shelter (objekt_id)" i stedet for "Ukendt Shelter". Beskrivelse kommer fra **`beskrivels`** / **`d_k_beskr`**. Billeder importeres fra GeoFA-felterne **foto_link** / **geofafoto** når de er udfyldt; mange faciliteter har ingen billed-URL i GeoFA.

**Billeder fra udinaturen.dk:** [Udinaturen.dk](https://udinaturen.dk) viser samme faciliteter (samme id som GeoFA) og har ofte billeder. For shelters uden `image_url` kan du køre `python3 fetch_udinaturen_images.py` – scriptet henter facilitetssiden på udinaturen.dk (via `source_id`) og opdaterer `image_url` / `image_urls`.

**By/kommune fra koordinater:** Hvis shelters mangler by ved MapPin, kan du udfylde `kommune` via reverse geocoding: `python3 backfill_kommune_from_geo.py`. Bruger OpenStreetMap Nominatim (gratis, 1 req/s). Kør evt. `--dry-run` først.

## Hvis GeoFA giver 500 (serverfejl)

GeoFA WFS kan desværre give **500** fra deres server. Brug da **lokal GeoJSON** fra de officielle værktøjer.

### Officiel dokumentation (Klimadatastyrelsen/SDFI)

- **[Hent GeoFA-data i GIS](https://confluence.sdfi.dk/pages/viewpage.action?pageId=175014435)** – oversigt over alle måder at hente data:
  - **WFS** (vores script prøver dette automatisk)
  - **Download gennem GeoFA-webkort**
  - **Download gennem GeoFA-editor**
- **[Hent GeoFA](https://www.geodanmark.dk/home/vejledninger/geofa/hent-geofa/)** – GeoDanmarks egen vejledning med links til SQL-API og værktøjer.
- På Confluence står der også: *"Undersøg data via download af fil (excel, GeoJSON mm.)"* – den side beskriver trin til at downloade i GeoJSON/Excel.

### Manuel download af GeoJSON

1. **GeoFA-webkortet:** [geofa-kort.geodanmark.dk](https://geofa-kort.geodanmark.dk) – åbn kortet, vælg lag "Facilitet punkt" (shelters m.m.), og brug evt. export/download hvis den findes.
2. **GeoFA-editor:** [geofa.geodanmark.dk/editor](https://geofa.geodanmark.dk/editor) – her kan man også hente/eksportere data.
3. **Opendata.dk:** [opendata.dk/geodanmark/geofa](https://www.opendata.dk/geodanmark/geofa) – under "6 data files" er der links til SQL-API og webkort.
4. Gem den downloaded fil som **`geofa_shelters.geojson`** i mappen `shelterdk/`.

Eller sæt sti til din fil:

```bash
export GEOFA_GEOJSON_FILE=/sti/til/din/fil.geojson
python3 import_shelters.py
```

### Hjælp til at fixe 500 hos GeoFA

500-fejlen kom ofte af at **typeName** manglede schema-prefix: serveren forventer `fkg:fkg.t_5800_fac_pkt` (med "fkg." foran tabellen), ikke `fkg:t_5800_fac_pkt`. Import-scriptet bruger nu det korrekte lag-navn. Hvis du stadig ser 500 fra GeoFA (PHP: `$layer` null i Wms.php), kan du:

1. **Prøve de ekstra forsøg scriptet nu laver:** GET med `Accept: application/json`, og en **POST GetFeature** med XML-body (nogle servere håndterer kun POST korrekt).
2. **Køre GetCapabilities for at tjekke serveren:**
   ```bash
   python3 geofa_debug_capabilities.py
   ```
   Hvis du får status 200, ved vi at WFS i det mindste svarer på GetCapabilities.
3. **Rapporter fejlen til GeoFA:** Send en kort beskrivelse og fejlbeskeden til **support@geopartner.dk** (man–fre 9–16) eller **lihv@kl.dk** (Line Hvingel, ansvarlig for GeoFA). Nævn at GetFeature med typeName/typeNames giver 500 og at fejlen er i `Wms.php` (Argument #6 `$layer` null).

### Book en Shelter (bookenshelter.dk) – gratis alternativer

Book en Shelter har **ikke et offentligt API**, og deres server blokerer ofte automatiske kald (455) fra datacentre. **Kør altid scriptene fra din egen computer** (hjemme-IP) så blokering ofte undgås.

**1. Opret staging-tabel i Supabase** (én gang):  
Kør i SQL Editor indholdet af `migrations/002_bookenshelter_raw.sql`.

**2. Gratis måder at få data på:**

- **URL-liste (anbefalet, 100 % gratis)**  
  Alle shelter-sider indeholder **/shelterplads/** i URL'en.  
  1. Søg i Google: **site:bookenshelter.dk shelterplads**.  
  2. Kopiér links til enkelte shelter-sider ind i `bookenshelter_urls.txt` (én URL per linje). Se `bookenshelter_urls.txt.example`.  
  3. Kør lokalt:
  ```bash
  python3 fetch_bookenshelter_from_urls.py
  ```
  Scriptet henter hver URL, udtrækker koordinater/titel/billeder og gemmer GeoJSON + `bookenshelter_raw`. Hvis en side ikke har koordinater, udtrækkes adressen fra teksten (fx "Nyborgvej 518, 5881 Skårup") og geocodes via Nominatim (OpenStreetMap), så flere shelters får koordinater.

- **Sitemap (gratis, kør lokalt)**  
  Når du kører fra din maskine, returnerer bookenshelter.dk nogle gange sitemap uden 455. Prøv:
  ```bash
  python3 fetch_bookenshelter_sitemap.py
  ```
  Hvis du kun får 0–2 URLs, er sitemappen tom eller blokeret – brug URL-listen i stedet.

- **Playwright (gratis, kræver browser)**  
  ```bash
  pip3 install playwright && python3 -m playwright install chromium
  python3 fetch_bookenshelter_playwright.py
  ```
  Åbner find-en-shelter i headless Chrome og fanger netværk/DOM. Virker ofte ikke fordi kort-data loades lukket.

**3. Match mod GeoFA-shelters:**

```bash
python3 match_bookenshelter_to_shelters.py
```

**Betalt alternativ:** [Oxylabs](https://oxylabs.io) Web Scraper API – sæt `OXYLABS_USER` og `OXYLABS_PASSWORD` i `.env` og kør `python3 fetch_bookenshelter_oxylabs.py`. Se scriptets docstring.

### Naturstyrelsen (book.naturstyrelsen.dk)

Mange shelters på Naturstyrelsens arealer kan bookes via [book.naturstyrelsen.dk](https://book.naturstyrelsen.dk). Søg-siden loader steder med JavaScript, så der er ingen simpel sitemap – du samler links manuelt.

**1. Opret tabel i Supabase** (én gang):  
Kør i SQL Editor indholdet af `migrations/003_naturstyrelsen_raw.sql`.

**2. Find URLs og hent data:**

- Søg fx: **site:book.naturstyrelsen.dk/sted/** og kopiér links til enkelte shelter/sted-sider.
- Gem dem i `naturstyrelsen_urls.txt` (én URL per linje). Se `naturstyrelsen_urls.txt.example`.
- Kør:
  ```bash
  python3 fetch_naturstyrelsen_from_urls.py
  ```
  Scriptet udtrækker titel, beskrivelse og adresse fra hver side, geocoder adressen (Nominatim) hvis der ikke er koordinater, og gemmer i `naturstyrelsen_raw` + GeoJSON.

**3. Match mod GeoFA-shelters:**

```bash
python3 match_naturstyrelsen_to_shelters.py
```

Kun shelters der **ikke** allerede har `booking_url` (fx fra Book en Shelter) opdateres, så begge kilder kan bruges uden at overskrive hinanden.

### Test med prøvedata

For at tjekke at Supabase-importen virker, kan du bruge den medfølgende testfil med et par shelters:

```bash
cp geofa_shelters_sample.geojson geofa_shelters.geojson
python3 import_shelters.py
```
