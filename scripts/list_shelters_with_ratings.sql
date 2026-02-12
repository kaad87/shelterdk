-- Overblik over shelters der har Google-rating.
-- Kør i Supabase → SQL Editor.
-- "vises_på_sitet" = ja når google_stednavn indeholder "shelter" (samme regel som web-appen).

SELECT
  s.title,
  s.slug,
  s.google_rating,
  s.google_user_ratings_total AS antal_anmeldelser,
  COALESCE(s.google_place_name, p.name) AS google_stednavn,
  (COALESCE(s.google_place_name, p.name) ILIKE '%shelter%') AS vises_på_sitet
FROM shelters s
LEFT JOIN google_places p ON p.google_place_id = s.google_place_id
WHERE s.google_rating IS NOT NULL
   OR s.google_place_id IS NOT NULL
ORDER BY (COALESCE(s.google_place_name, p.name) ILIKE '%shelter%') DESC, s.google_user_ratings_total DESC NULLS LAST, s.google_rating DESC NULLS LAST;
