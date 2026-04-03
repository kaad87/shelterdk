-- Optimized bbox RPC: select only columns needed for map markers instead of s.*
-- This dramatically reduces egress by excluding geofa_raw (~2-5KB per row).

create or replace function public.get_shelters_in_bbox(
  p_nord double precision,
  p_syd double precision,
  p_ost double precision,
  p_vest double precision
)
returns table (
  id uuid,
  title text,
  slug text,
  location text,
  image_url text,
  image_urls jsonb,
  user_image_urls jsonb,
  google_rating double precision,
  google_user_ratings_total integer,
  google_place_id text,
  booking_url text,
  region text,
  kommune text,
  water boolean,
  toilet text,
  capacity integer,
  display_score double precision
)
language sql stable
set search_path = public
as $$
  with bbox as (
    select ST_SetSRID(
      ST_MakeEnvelope(p_vest, p_syd, p_ost, p_nord),
      4326
    ) as geom
  )
  select
    s.id, s.title, s.slug, s.location,
    s.image_url, s.image_urls, s.user_image_urls,
    s.google_rating, s.google_user_ratings_total, s.google_place_id,
    s.booking_url, s.region, s.kommune,
    s.water, s.toilet, s.capacity, s.display_score
  from public.shelters s
  cross join bbox
  where s.duplicate_of_shelter_id is null
    and s.location is not null
    and s.location ~ '^POINT\s*\('
    and ST_Intersects(
      bbox.geom,
      ST_GeomFromText(s.location, 4326)
    )
  order by s.display_score desc nulls last, s.title asc
  limit 2000;
$$;

comment on function public.get_shelters_in_bbox(double precision, double precision, double precision, double precision) is
  'Returnerer shelters (lette kolonner, uden geofa_raw) inden for bbox. Bruges til kortvisning.';
