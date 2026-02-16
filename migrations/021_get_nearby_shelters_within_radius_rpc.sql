-- Nærmeste shelters inden for en given radius (PostGIS ST_Distance).
-- Input: shelter-id; returnerer op til N shelters inden for radius_km (default 15 km, 3 stk).
-- Kør i Supabase SQL Editor. Kræver PostGIS og location på formen POINT(lon lat).

create or replace function public.get_nearby_shelters_within_radius(
  p_shelter_id uuid,
  p_radius_km double precision default 15,
  p_limit int default 3
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
  with center as (
    select ST_GeomFromText(s.location, 4326)::geography as g
    from public.shelters s
    where s.id = p_shelter_id
      and s.location is not null
      and s.location ~ '^POINT\s*\('
    limit 1
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
    round((ST_Distance(center.g, ST_GeomFromText(s.location, 4326)::geography) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.shelters s
  cross join center
  where s.location is not null
    and s.duplicate_of_shelter_id is null
    and s.location ~ '^POINT\s*\('
    and s.id != p_shelter_id
    and ST_Distance(center.g, ST_GeomFromText(s.location, 4326)::geography) <= (least(greatest(p_radius_km, 0.1), 100) * 1000.0)
  order by center.g <-> ST_GeomFromText(s.location, 4326)::geography
  limit least(greatest(p_limit, 1), 10);
$$;

comment on function public.get_nearby_shelters_within_radius(uuid, double precision, int) is
  'Returnerer de nærmeste shelters inden for radius_km (default 15 km), max p_limit (default 3). Bruges til "Andre shelters i nærheden".';
