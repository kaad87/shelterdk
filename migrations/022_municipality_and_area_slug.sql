-- Tilføj kommune (fra DAWA reverse geocoding) og SEO-område (area_slug).
-- Kør i Supabase SQL Editor.
-- Efter migration: kør backfill fra web-mappen: npm run backfill:municipality

alter table public.shelters
  add column if not exists municipality text,
  add column if not exists area_slug text;

comment on column public.shelters.municipality is 'Kommune fra DAWA reverse geocoding (lat/lon). Udfyldes af backfill-municipality-dawa.js.';
comment on column public.shelters.area_slug is 'SEO-område (fx lolland, bornholm, nordsjaelland). Afledt af municipality via mapping i backfill-script.';

create index if not exists idx_shelters_municipality on public.shelters(municipality) where municipality is not null;
create index if not exists idx_shelters_area_slug on public.shelters(area_slug) where area_slug is not null;
