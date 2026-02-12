-- Fjern præfikset "Book en Shelter: " (eller "Book en Shelter:") fra shelter-titler.
-- Kør én gang i Supabase → SQL Editor.

update public.shelters
set title = trim(regexp_replace(title, '^Book en Shelter:\s*', '', 'i'))
where title ~* '^Book en Shelter:\s*';
