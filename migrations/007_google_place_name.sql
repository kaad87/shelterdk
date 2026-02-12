-- Tilføj google_place_name på shelters så vi kan vise rating kun når stednavn indeholder "shelter".
-- Kør i Supabase → SQL Editor.

alter table public.shelters add column if not exists google_place_name text;

-- Udfyld fra google_places for eksisterende rækker
update public.shelters s
set google_place_name = p.name
from public.google_places p
where s.google_place_id = p.google_place_id
  and s.google_place_name is distinct from p.name;

comment on column public.shelters.google_place_name is 'Navn på matchet Google-sted; bruges til at vise rating kun når navnet indeholder "shelter".';
