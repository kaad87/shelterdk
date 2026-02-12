-- Kør i Supabase → SQL Editor (én gang).
-- Tilføjer kolonner til shelters så import kan gemme alle GeoFA-felter og billedlink.

alter table public.shelters add column if not exists geofa_raw jsonb;
alter table public.shelters add column if not exists image_url text;
alter table public.shelters add column if not exists image_urls jsonb;
