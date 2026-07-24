-- 054_spatial_geog_and_indexed_nearby_rpcs.sql
--
-- Baggrund: shelters.location og nature_stays.location er gemt som TEXT (WKT).
-- Nærheds-RPC'erne kaldte ST_GeomFromText(location)::geography pr. række pr. kald
-- uden noget spatial-indeks -> fuld tabel-scan ved hvert opslag. Under load spikede
-- de til 3-6s, mættede DB-CPU'en, Netlify-funktioner timede ud MIDT i transaktionen,
-- forbindelser hobede sig op som "idle in transaction", connection-poolen fyldtes,
-- og hele siden gik ned med "edge function timed out".
--
-- Fix: en genereret (STORED) geography-kolonne + GiST-indeks, og RPC'erne skrevet
-- om til at bruge den indekserede kolonne (ST_DWithin / <-> KNN -> index-scan).

-- 1) shelters: genereret geografi-kolonne (null-sikker) + GiST-indeks
alter table public.shelters
  add column if not exists geog geography
  generated always as (
    case when location ~ '^POINT\s*\(' then ST_GeomFromText(location, 4326)::geography end
  ) stored;
create index if not exists idx_shelters_geog
  on public.shelters using gist (geog) where geog is not null;

-- 2) nature_stays: samme mønster (0 rækker nu — fremtidssikring)
alter table public.nature_stays
  add column if not exists geog geography
  generated always as (
    case when location ~ '^POINT\s*\(' then ST_GeomFromText(location, 4326)::geography end
  ) stored;
create index if not exists idx_nature_stays_geog
  on public.nature_stays using gist (geog) where geog is not null;

-- 3) RPC'er skrevet om til indekseret s.geog (uændrede signaturer + returtyper).

create or replace function public.get_nearby_shelters(
  p_lat double precision, p_lng double precision,
  p_exclude_id uuid default null::uuid, p_limit integer default 5)
returns table(id uuid, title text, slug text, image_url text, image_urls jsonb,
  region text, kommune text, place text, booking_url text, google_rating double precision,
  google_user_ratings_total integer, google_place_name text, distance_km double precision)
language sql stable set search_path to 'public'
as $function$
  with pt as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    s.id, s.title, s.slug, s.image_url, s.image_urls, s.region, s.kommune, s.place,
    s.booking_url, s.google_rating, s.google_user_ratings_total, s.google_place_name,
    round((ST_Distance(pt.g, s.geog) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.shelters s
  cross join pt
  where s.geog is not null
    and s.duplicate_of_shelter_id is null
    and (p_exclude_id is null or s.id != p_exclude_id)
  order by s.geog <-> pt.g
  limit least(greatest(p_limit, 1), 20);
$function$;

create or replace function public.get_nearby_shelters_within_radius(
  p_shelter_id uuid, p_radius_km double precision default 15, p_limit integer default 3)
returns table(id uuid, title text, slug text, image_url text, image_urls jsonb,
  region text, kommune text, place text, booking_url text, google_rating double precision,
  google_user_ratings_total integer, google_place_name text, distance_km double precision)
language sql stable set search_path to 'public'
as $function$
  with center as (
    select s.geog as g
    from public.shelters s
    where s.id = p_shelter_id and s.geog is not null
    limit 1
  )
  select
    s.id, s.title, s.slug, s.image_url, s.image_urls, s.region, s.kommune, s.place,
    s.booking_url, s.google_rating, s.google_user_ratings_total, s.google_place_name,
    round((ST_Distance(center.g, s.geog) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.shelters s
  cross join center
  where s.geog is not null
    and s.duplicate_of_shelter_id is null
    and s.id != p_shelter_id
    and ST_DWithin(s.geog, center.g, least(greatest(p_radius_km, 0.1), 100) * 1000.0)
  order by s.geog <-> center.g
  limit least(greatest(p_limit, 1), 10);
$function$;

create or replace function public.get_shelters_in_bbox(
  p_nord double precision, p_syd double precision, p_ost double precision, p_vest double precision)
returns table(id uuid, title text, slug text, location text, image_url text, image_urls jsonb,
  user_image_urls jsonb, google_rating double precision, google_user_ratings_total integer,
  google_place_id text, booking_url text, region text, kommune text, water boolean,
  toilet text, capacity integer, display_score double precision)
language sql stable set search_path to 'public'
as $function$
  with bbox as (
    select ST_SetSRID(ST_MakeEnvelope(p_vest, p_syd, p_ost, p_nord), 4326)::geography as g
  )
  select
    s.id, s.title, s.slug, s.location, s.image_url, s.image_urls, s.user_image_urls,
    s.google_rating, s.google_user_ratings_total, s.google_place_id,
    s.booking_url, s.region, s.kommune, s.water, s.toilet, s.capacity, s.display_score
  from public.shelters s
  cross join bbox
  where s.duplicate_of_shelter_id is null
    and s.geog is not null
    and ST_Intersects(bbox.g, s.geog)
  order by s.display_score desc nulls last, s.title asc
  limit 2000;
$function$;

create or replace function public.get_nearby_stays(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision default 25, p_limit integer default 3)
returns table(id bigint, slug text, name text, type text, image_url text, region text,
  kommune text, place text, price_from integer, booking_url text, link_source text,
  distance_km double precision)
language sql stable set search_path to 'public'
as $function$
  with pt as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    s.id, s.slug, s.name, s.type, s.image_url, s.region, s.kommune, s.place,
    s.price_from, s.booking_url, s.link_source,
    round((ST_Distance(pt.g, s.geog) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.nature_stays s
  cross join pt
  where s.status = 'published'
    and s.geog is not null
    and ST_DWithin(pt.g, s.geog, greatest(p_radius_km, 0) * 1000.0)
  order by s.geog <-> pt.g
  limit least(greatest(p_limit, 1), 20);
$function$;

-- 4) Defense-in-depth: luk forladte transaktioner på web-request-stien (PostgREST
--    forbinder som 'authenticator') så en langsom periode ikke igen kan hobe
--    zombie-forbindelser op og mætte poolen. Rammer ikke direkte postgres-
--    forbindelser (backfill-scripts).
alter role authenticator set idle_in_transaction_session_timeout = '10000';
