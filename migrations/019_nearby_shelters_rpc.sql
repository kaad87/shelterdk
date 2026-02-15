-- Nearby shelters by distance (PostGIS). Enable extension then create RPC.
-- Kør i Supabase SQL Editor. Kræver at location er på formen POINT(lon lat).

create extension if not exists postgis;

create or replace function public.get_nearby_shelters(
  p_lat double precision,
  p_lng double precision,
  p_exclude_id uuid default null,
  p_limit int default 5
)
returns table (
  id uuid,
  title text,
  slug text,
  image_url text,
  image_urls jsonb,
  region text,
  kommune text,
  place text,
  booking_url text,
  google_rating double precision,
  google_user_ratings_total integer,
  google_place_name text,
  distance_km double precision
)
language sql stable
set search_path = public
as $$
  with pt as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    s.id,
    s.title,
    s.slug,
    s.image_url,
    s.image_urls,
    s.region,
    s.kommune,
    s.place,
    s.booking_url,
    s.google_rating,
    s.google_user_ratings_total,
    s.google_place_name,
    round((ST_Distance(pt.g, ST_GeomFromText(s.location, 4326)::geography) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.shelters s
  cross join pt
  where s.location is not null
    and s.duplicate_of_shelter_id is null
    and s.location ~ '^POINT\s*\('
    and (p_exclude_id is null or s.id != p_exclude_id)
  order by pt.g <-> ST_GeomFromText(s.location, 4326)::geography
  limit least(greatest(p_limit, 1), 20);
$$;

comment on function public.get_nearby_shelters(double precision, double precision, uuid, int) is
  'Returnerer de nærmeste shelters til et punkt (lat, lng). distance_km i km. Bruges til NearbyShelters.';
