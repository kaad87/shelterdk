-- Toilet på pladsen (flush, mulch, none, unknown). Bruges til FAQ på sheltersiden.
-- Opretter kolonnen kun hvis den mangler (schema.sql kan allerede have den).

alter table public.shelters
  add column if not exists toilet text check (toilet in ('flush', 'mulch', 'none', 'unknown'));

comment on column public.shelters.toilet is 'Toilet på pladsen: flush, mulch, none eller unknown. Sættes ved import fra GeoFA.';
