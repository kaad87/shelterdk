-- By/kommune til visning ved MapPin (udfyldes ved GeoFA-import fra beliggenhedskommune / postnr_by).
alter table public.shelters add column if not exists kommune text;

comment on column public.shelters.kommune is 'By eller kommune til visning (fx Sønderborg, Rebild). Sættes ved import fra GeoFA.';

-- Backfill: udfyld kommune fra geofa_raw for eksisterende rækker (beliggenhedskommune eller by fra postnr_by).
update public.shelters
set kommune = coalesce(
  nullif(trim(geofa_raw->>'beliggenhedskommune'), ''),
  nullif(trim(regexp_replace(coalesce(geofa_raw->>'postnr_by', ''), '^\s*\d+\s*[,-]?\s*', '')), '')
)
where geofa_raw is not null and (kommune is null or kommune = '');
