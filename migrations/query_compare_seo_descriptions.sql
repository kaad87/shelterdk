-- Sammenlign seo_description (AI-tekst) med description (original) for shelters med seo_description.
-- Kør i Supabase SQL Editor for at gennemse og vurdere AI-omskrivningerne.

WITH slugify AS (
  SELECT
    s.*,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(s.region, '')), ' +', '-', 'g'), 'æ', 'ae', 'g'), 'ø', 'oe', 'g'), 'å', 'aa', 'g'), '[^a-z0-9-]', '', 'g')) AS region_slug,
    COALESCE(
      NULLIF(LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(COALESCE(s.kommune, '')), ' +', '-', 'g'), 'æ', 'ae', 'g'), 'ø', 'oe', 'g'), 'å', 'aa', 'g'), '[^a-z0-9-]', '', 'g')), ''),
      'ukendt-kommune'
    ) AS kommune_slug
  FROM public.shelters s
)
SELECT
  id,
  title,
  slug,
  region,
  kommune,
  'https://shelterdk.dk' || CASE
    WHEN region IS NOT NULL AND TRIM(region) != '' AND TRIM(region) != 'Danmark' AND region_slug != ''
    THEN '/danmark/' || region_slug || '/' || kommune_slug || '/' || slug
    ELSE '/shelter/' || slug
  END AS url,
  description AS original_beskrivelse,
  seo_description AS seo_beskrivelse,
  COALESCE(LENGTH(description), 0) AS original_tegn,
  COALESCE(LENGTH(seo_description), 0) AS seo_tegn
FROM slugify
WHERE seo_description IS NOT NULL
  AND TRIM(seo_description) != ''
  AND duplicate_of_shelter_id IS NULL
ORDER BY title;
