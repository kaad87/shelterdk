-- Kør i Supabase → SQL Editor (én gang).
-- Opretter staging-tabel til Naturstyrelsen book.naturstyrelsen.dk data.

create table if not exists public.naturstyrelsen_raw (
  id uuid primary key default gen_random_uuid(),
  naturstyrelsen_id text unique,
  name text,
  location text,
  booking_url text,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.naturstyrelsen_raw enable row level security;

create policy "naturstyrelsen_raw læsbar"
  on public.naturstyrelsen_raw for select using (true);
create policy "naturstyrelsen_raw insert"
  on public.naturstyrelsen_raw for insert with check (true);
create policy "naturstyrelsen_raw update"
  on public.naturstyrelsen_raw for update using (true);

comment on table public.naturstyrelsen_raw is 'Rå data fra book.naturstyrelsen.dk – hentet via fetch_naturstyrelsen_from_urls.py';
