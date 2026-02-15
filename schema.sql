-- Kør denne SQL i Supabase Dashboard → SQL Editor
-- Opretter tabellen "shelters" som import_shelters.py forventer.

create table if not exists public.shelters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text default '',
  location text,
  region text default 'Danmark',
  toilet text check (toilet in ('flush', 'mulch', 'none', 'unknown')),
  water boolean,
  access text default 'public',
  mode text default 'first_come',
  source_id text,
  -- Rå GeoFA-properties (hele feature.properties som JSON)
  geofa_raw jsonb,
  -- Primært billede-link fra GeoFA (første ikke-tomme foto_link/geofafoto)
  image_url text,
  -- Alle billed-URL'er fra GeoFA (foto_link, foto_link1–3, geofafoto, geofafoto1–3)
  image_urls jsonb,
  -- Ekstra berigede felter fra GeoFA
  capacity integer,
  booking_url text,
  is_free boolean,
  booking_required boolean,
  owner_name text,
  owner_type text,
  contact text,
  season text,
  season_note text,
  open_24_7 boolean,
  wheelchair_accessible boolean,
  verified boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: alle kan læse; alle kan indsætte/opdatere (så import-script med anon key virker)
alter table public.shelters enable row level security;

create policy "Shelters er offentligt læsbare"
  on public.shelters for select using (true);

create policy "Tillad insert og update (til import)"
  on public.shelters for insert with check (true);
create policy "Tillad update (til import)"
  on public.shelters for update using (true);

-- Opdater updated_at ved ændring (valgfrit)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shelters_updated_at on public.shelters;
create trigger shelters_updated_at
  before update on public.shelters
  for each row execute function public.set_updated_at();

comment on table public.shelters is 'Shelters fra GeoFA / udinaturen.dk – importeret via shelterdk/import_shelters.py';
