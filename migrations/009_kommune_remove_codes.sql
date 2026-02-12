-- Fjern kommunekoder fra kommune-kolonnen (kun bynavne skal vises, ikke tal som 400, 219).
update public.shelters
set kommune = null
where kommune ~ '^\s*\d+\s*$';
