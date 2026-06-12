-- Egen logning af affiliate-klik (i dag kun GA4) — grundlag for at optimere
-- produktvalg/rækkefølge og se hvilke kategorier/placeringer der tjener penge.
create table if not exists affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_name text,
  retailer text,
  brand text,
  category text,
  placement text,          -- editorial | product | pill | deals_widget | guide_overview | guide_table
  price_dkk numeric,
  outbound_url text,
  path text                -- siden klikket skete fra
);

create index if not exists affiliate_clicks_created_at_idx on affiliate_clicks (created_at desc);
create index if not exists affiliate_clicks_placement_idx on affiliate_clicks (placement);

-- Kun service-role skriver/læser (ingen public policies).
alter table affiliate_clicks enable row level security;
