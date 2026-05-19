# Guide: Direkte bookinglinks på shelters

Den nye bookingmodel skelner mellem:

- `internal` — bookes direkte på ShelterDK
- `external_direct` — vi kender et konkret eksternt bookinglink
- `external_search` — udbyderen er kendt, men brugeren skal søge der
- `contact_only` — shelteret kræver booking, men vi har ikke et link endnu
- `first_come` — ingen reservation, først til mølle

Til datamodellen hører felterne:

- `booking_provider`
- `booking_link_mode`
- `booking_lookup_key`
- `booking_url_verified_at`
- `booking_confidence`

## 1. Kør migrationen

Kør filen:

`web/migrations/20260516_shelter_booking_model.sql`

i Supabase SQL Editor.

## 2. Backfill eksisterende bookinglinks fra GeoFA/Udinaturen

```bash
python3 backfill_booking_url_from_geofa.py
```

Det udfylder `booking_url` for shelters, hvor GeoFA allerede indeholder et
direkte Udinaturen-link, og sætter samtidig:

- `booking_provider = 'udinaturen'`
- `booking_link_mode = 'external_direct'`
- `booking_confidence = 'imported'`

## 3. Hent og match Naturstyrelsen

Hvis du ikke allerede har fyldt `naturstyrelsen_raw`:

```bash
python3 fetch_naturstyrelsen_from_urls.py
python3 match_naturstyrelsen_to_shelters.py
```

Match-scriptet sætter nu også:

- `booking_provider = 'naturstyrelsen'`
- `booking_link_mode = 'external_direct'`
- `booking_lookup_key = <sted-slug>`
- `booking_confidence = 'verified_match'`

## 4. Backfill resten af bookingmodellen

```bash
python3 backfill_shelter_booking_model.py --dry-run
python3 backfill_shelter_booking_model.py
```

Scriptet rører kun booking-metadatafelterne og overskriver ikke:

- titel
- beskrivelse
- billeder
- eksisterende `booking_url`

Det bruges til at klassificere shelters som fx:

- `external_search` for Naturstyrelsen-shelters uden konkret underside
- `contact_only` for shelters der kræver booking, men hvor vi kun kender kontakten
- `first_come` for shelters uden reservation

## 5. Render-logik på sheltersider

Frontend bruger nu den gemte bookingmodel først og falder kun tilbage til
heuristik, hvis felterne endnu ikke er backfill’et.

Det betyder:

- direkte links vises kun når vi faktisk har en `booking_url`
- Naturstyrelsen-fallback bruges kun som fallback
- facts-boksen siger ikke længere `Bookbart via ShelterDK`, når shelteret i virkeligheden kun har ekstern booking
