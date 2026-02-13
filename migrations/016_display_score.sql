-- Rangering: score fra antal billeder (tæller mest) + antal anmeldelser.
-- Brug display_score til sortering på /soeg og forsiden.
-- Formel: billeder * 100 + min(anmeldelser, 500). Flere billeder vægtes højere; anmeldelser bidrager op til 500.

alter table public.shelters
  add column if not exists display_score integer generated always as (
    (
      (case when image_url is not null and trim(coalesce(image_url, '')) <> '' then 1 else 0 end)
      + coalesce(jsonb_array_length(coalesce(image_urls, '[]'::jsonb)), 0)
      + coalesce(jsonb_array_length(coalesce(user_image_urls, '[]'::jsonb)), 0)
    ) * 100
    + least(coalesce((google_user_ratings_total)::int, 0), 500)
  ) stored;

create index if not exists idx_shelters_display_score on public.shelters(display_score desc nulls last);

comment on column public.shelters.display_score is 'Beregnet score til rangering: antal billeder * 100 + anmeldelser (max 500). Højere = bedre visning.';
