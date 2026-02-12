-- Kør i Supabase → SQL Editor (én gang).
-- Opretter staging-tabel til Book en Shelter data.

create table if not exists public.bookenshelter_raw (
  id uuid primary key default gen_random_uuid(),
  bookenshelter_id text unique,
  name text,
  location text,
  booking_url text,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bookenshelter_raw enable row level security;

create policy "bookenshelter_raw læsbar"
  on public.bookenshelter_raw for select using (true);
create policy "bookenshelter_raw insert"
  on public.bookenshelter_raw for insert with check (true);
create policy "bookenshelter_raw update"
  on public.bookenshelter_raw for update using (true);

comment on table public.bookenshelter_raw is 'Rå data fra bookenshelter.dk – hentet via fetch_bookenshelter_playwright.py';
