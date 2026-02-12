-- Tjek om kommune er udfyldt. Kør i Supabase → SQL Editor.
-- De første 20 shelters (med billede) og deres kommune:
SELECT title, kommune, location IS NOT NULL AS has_location
FROM public.shelters
WHERE duplicate_of_shelter_id IS NULL
  AND image_url IS NOT NULL AND image_url != ''
ORDER BY title
LIMIT 20;
