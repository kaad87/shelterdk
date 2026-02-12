-- Shelters uden by/kommune (ingen MapPin-tekst på kortet).
-- kommune er NULL, tom eller kun tal = ingen pin.
-- has_location = true betyder at backfill_kommune_from_geo.py kan udfylde dem.
SELECT
  id,
  title,
  slug,
  location IS NOT NULL AS has_location,
  kommune,
  region
FROM public.shelters
WHERE duplicate_of_shelter_id IS NULL
  AND (
    kommune IS NULL
    OR trim(kommune) = ''
    OR kommune ~ '^\s*\d+\s*$'
  )
ORDER BY title;
