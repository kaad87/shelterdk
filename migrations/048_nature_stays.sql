-- 048_nature_stays.sql — kurateret naturophold-/glamping-datalag (affiliate)
-- Kør i Supabase SQL Editor (manuelt, som øvrige migrationer).
-- location gemmes som TEKST på formen 'POINT(lng lat)' (samme konvention som
-- public.shelters), så PostgREST-insert er triviel; castes til geography i RPC.

create extension if not exists postgis;

-- ── Steder ──────────────────────────────────────────────────────────────
create table if not exists public.nature_stays (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  name          text not null,
  operator_name text,
  type          text not null,                       -- glamping_telt | naturhytte | dome | traehus | tiny_house | luksus_shelter ...
  region        text,
  kommune       text,
  place         text,
  location      text,                                -- 'POINT(lng lat)' WKT
  short_description text,
  body_md       text,
  image_url     text,
  image_urls    text[] not null default '{}',
  image_permission text,                             -- proveniens: hvem/hvornår gav lov
  price_from    integer,                             -- kr/nat, vejledende
  capacity      integer,
  amenities     jsonb not null default '{}'::jsonb,
  rating        numeric(2,1),
  booking_url   text,
  link_source   text not null default 'direkte'
                  check (link_source in ('booking_com','direkte','andet_netvaerk')),
  featured      boolean not null default false,
  sort_boost    integer not null default 0,
  status        text not null default 'draft' check (status in ('draft','published')),
  last_verified_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists nature_stays_status_idx on public.nature_stays (status);
create index if not exists nature_stays_region_idx on public.nature_stays (region);

-- ── Guider ──────────────────────────────────────────────────────────────
create table if not exists public.stay_guides (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  title         text not null,
  intro         text,
  body_md       text,
  seo_title     text,
  seo_description text,
  faq           jsonb not null default '[]'::jsonb,
  sources       jsonb not null default '[]'::jsonb,
  author        text,
  parent_slug   text,
  status        text not null default 'draft' check (status in ('draft','published')),
  last_reviewed_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.stay_guide_entries (
  id             bigint generated always as identity primary key,
  guide_id       bigint not null references public.stay_guides(id) on delete cascade,
  nature_stay_id bigint not null references public.nature_stays(id) on delete cascade,
  rank           integer not null default 0,
  award_label    text,
  best_for       text,
  editorial_note text,
  created_at     timestamptz not null default now(),
  unique (guide_id, nature_stay_id)
);

-- ── updated_at-triggere (genbruger delt funktion) ────────────────────────
drop trigger if exists nature_stays_updated_at on public.nature_stays;
create trigger nature_stays_updated_at before update on public.nature_stays
  for each row execute function public.set_updated_at();
drop trigger if exists stay_guides_updated_at on public.stay_guides;
create trigger stay_guides_updated_at before update on public.stay_guides
  for each row execute function public.set_updated_at();

-- ── RLS — offentlig LÆSNING; skrivning KUN via service_role (jf. 045-lockdown) ──
-- Ingen insert/update/delete-policies → anon kan ikke skrive; service_role
-- bypasser altid RLS, så admin-API-routes (x-admin-secret + service_role) virker.
alter table public.nature_stays enable row level security;
create policy "nature_stays læsbar" on public.nature_stays for select using (true);

alter table public.stay_guides enable row level security;
create policy "stay_guides læsbar" on public.stay_guides for select using (true);

alter table public.stay_guide_entries enable row level security;
create policy "stay_guide_entries læsbar" on public.stay_guide_entries for select using (true);

-- ── Nærmeste publicerede stays (Plan B) — spejler get_nearby_shelters ────
create or replace function public.get_nearby_stays(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 25,
  p_limit int default 3
)
returns table (
  id bigint,
  slug text,
  name text,
  type text,
  image_url text,
  region text,
  kommune text,
  place text,
  price_from integer,
  booking_url text,
  link_source text,
  distance_km double precision
)
language sql stable
set search_path = public
as $$
  with pt as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    s.id, s.slug, s.name, s.type, s.image_url, s.region, s.kommune, s.place,
    s.price_from, s.booking_url, s.link_source,
    round((ST_Distance(pt.g, ST_GeomFromText(s.location, 4326)::geography) / 1000.0)::numeric, 1)::double precision as distance_km
  from public.nature_stays s
  cross join pt
  where s.status = 'published'
    and s.location is not null
    and s.location ~ '^POINT\s*\('
    and ST_DWithin(pt.g, ST_GeomFromText(s.location, 4326)::geography, greatest(p_radius_km, 0) * 1000.0)
  order by pt.g <-> ST_GeomFromText(s.location, 4326)::geography
  limit least(greatest(p_limit, 1), 20);
$$;

comment on function public.get_nearby_stays(double precision, double precision, double precision, int) is
  'Returnerer de nærmeste PUBLICEREDE naturophold inden for radius (km) af et punkt. Bruges til Plan B på shelter-sider.';
