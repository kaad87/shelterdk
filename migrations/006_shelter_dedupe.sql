-- Kør i Supabase → SQL Editor (én gang).
-- Tilføjer felt til at markere dubletter mellem shelters.

alter table public.shelters
  add column if not exists duplicate_of_shelter_id uuid
  references public.shelters(id) on delete set null;

create index if not exists idx_shelters_duplicate_of
  on public.shelters (duplicate_of_shelter_id);

comment on column public.shelters.duplicate_of_shelter_id is
  'Hvis sat, peger på det shelter der er valgt som primær for samme fysiske sted.';

