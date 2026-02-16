-- PostGIS RPC: returner kun shelters inden for en bounding box (nord, syd, øst, vest).
-- Kør i Supabase SQL Editor. Kræver at location er på formen POINT(lon lat) og at postgis-extensionen er oprettet (fx fra 019_nearby_shelters_rpc.sql).

create extension if not exists postgis;

create or replace function public.get_shelters_in_bbox(
  p_nord double precision,
  p_syd double precision,
  p_ost double precision,
  p_vest double precision
)
returns setof public.shelters
language sql stable
set search_path = public
as $$
  with bbox as (
    select ST_SetSRID(
      ST_MakeEnvelope(p_vest, p_syd, p_ost, p_nord),
      4326
    ) as geom
  )
  select s.*
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
  'Returnerer shelters med placering inden for den angivne bbox (nord, syd, øst, vest). Bruges til kortvisning med PostGIS i stedet for at hente alle punkter.';
