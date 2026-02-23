-- Sammenlign seo_title med original title. Kør i Supabase SQL Editor.

SELECT
  id,
  title AS original_title,
  seo_title,
  region,
  kommune
FROM public.shelters
WHERE duplicate_of_shelter_id IS NULL
  AND seo_title IS NOT NULL
ORDER BY title;
