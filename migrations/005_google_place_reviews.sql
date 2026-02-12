-- Kør i Supabase → SQL Editor (én gang).
-- Opretter tabel til flade Google-anmeldelser pr. sted.

create table if not exists public.google_place_reviews (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null references public.google_places(google_place_id) on delete cascade,
  author_name text,
  rating double precision,
  text text,
  relative_time_description text,
  time timestamptz,
  raw_json jsonb,
  created_at timestamptz default now()
);

alter table public.google_place_reviews enable row level security;

create policy "google_place_reviews læsbar"
  on public.google_place_reviews for select using (true);

create policy "google_place_reviews insert"
  on public.google_place_reviews for insert with check (true);

create policy "google_place_reviews update"
  on public.google_place_reviews for update using (true);

create policy "google_place_reviews delete"
  on public.google_place_reviews for delete using (true);

comment on table public.google_place_reviews is 'Flade Google Places-anmeldelser (en række per review).';

