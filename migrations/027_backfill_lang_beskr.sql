-- Backfill description fra geofa_raw->lang_beskr for shelters der har en lang beskrivelse
-- men kun en kort/tom description (GeoFA lang_beskr foretrækkes over den korte beskrivels).
-- Kør i Supabase → SQL Editor.

UPDATE public.shelters
SET description = geofa_raw->>'lang_beskr'
WHERE geofa_raw->>'lang_beskr' IS NOT NULL
  AND geofa_raw->>'lang_beskr' != ''
  AND length(geofa_raw->>'lang_beskr') > length(COALESCE(description, ''));

-- Vis resultat
SELECT
  count(*) FILTER (WHERE geofa_raw->>'lang_beskr' IS NOT NULL AND geofa_raw->>'lang_beskr' != '') AS har_lang_beskr,
  count(*) FILTER (WHERE length(description) > 200) AS description_over_200t,
  round(avg(length(description))) AS gns_description_laengde
FROM public.shelters;
