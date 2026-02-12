-- Kør i Supabase → SQL Editor (én gang).
-- Opretter tabeller til Google Places-data og match shelter ↔ Google Place.
-- Tilføjer felter på shelters til rating og antal anmeldelser fra Google.

-- Google-steder (én række pr. Google Place)
create table if not exists public.google_places (
  google_place_id text primary key,
  name text,
  lat double precision,
  lng double precision,
  rating double precision,
  user_ratings_total integer,
  photo_references jsonb,
  raw_json jsonb,
  fetched_at timestamptz default now()
);

alter table public.google_places enable row level security;
create policy "google_places læsbar" on public.google_places for select using (true);
create policy "google_places insert" on public.google_places for insert with check (true);
create policy "google_places update" on public.google_places for update using (true);

comment on table public.google_places is 'Place-detaljer fra Google Places API – rating, anmeldelser, billeder.';

-- Match mellem shelters og Google Places
create table if not exists public.shelter_google_match (
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  google_place_id text not null references public.google_places(google_place_id) on delete cascade,
  match_score double precision not null,
  distance_meters double precision,
  auto_matched boolean default false,
  created_at timestamptz default now(),
  primary key (shelter_id, google_place_id)
);

create index if not exists idx_shelter_google_match_shelter on public.shelter_google_match (shelter_id);
create index if not exists idx_shelter_google_match_place on public.shelter_google_match (google_place_id);

alter table public.shelter_google_match enable row level security;
create policy "shelter_google_match læsbar" on public.shelter_google_match for select using (true);
create policy "shelter_google_match insert" on public.shelter_google_match for insert with check (true);
create policy "shelter_google_match update" on public.shelter_google_match for update using (true);
create policy "shelter_google_match delete" on public.shelter_google_match for delete using (true);

comment on table public.shelter_google_match is 'Match shelter ↔ Google Place (fra fetch_google_places.py).';

-- Berigelse af shelters: Google rating og antal anmeldelser (så UI kan vise uden join)
alter table public.shelters add column if not exists google_place_id text references public.google_places(google_place_id) on delete set null;
alter table public.shelters add column if not exists google_rating double precision;
alter table public.shelters add column if not exists google_user_ratings_total integer;
