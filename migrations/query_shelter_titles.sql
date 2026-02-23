-- Vis shelter-titler. Kør i Supabase SQL Editor.

SELECT id, title, slug, region, kommune
FROM public.shelters
WHERE duplicate_of_shelter_id IS NULL
ORDER BY title;
