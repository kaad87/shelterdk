-- Vand på pladsen (vandhane/drikkevand). Bruges til /shelter-med-vand og facilitet-visning.
-- Sættes ved import fra GeoFA (vandhane) og ved backfill fra beskrivelse.

alter table public.shelters
  add column if not exists water boolean;

comment on column public.shelters.water is 'Vand på pladsen (vandhane/drikkevand). true/false; null = ukendt. Sættes ved import og backfill_water.py.';
