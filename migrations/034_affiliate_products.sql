-- Affiliate products — Phase 1 of affiliate foundation.
-- Stores normalized products from three partner-ads XML feeds:
-- Backpackerlife.dk, Outdoortid.dk, Outmore.dk.

create table if not exists public.affiliate_products (
  id                  text primary key,
  retailer            text not null check (retailer in ('outmore', 'backpackerlife', 'outdoortid')),
  retailer_product_id text not null,
  brand               text,
  product_name        text not null,
  description         text,
  category_raw        text,
  category_mapped     text,
  price               numeric(10,2) not null,
  price_original      numeric(10,2),
  discount_pct        integer check (discount_pct is null or (discount_pct >= 0 and discount_pct <= 100)),
  shipping_cost       numeric(10,2),
  in_stock            boolean not null default true,
  stock_count         integer,
  image_url           text not null,
  affiliate_url       text not null,
  ean                 text,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  is_blocked          boolean not null default false,
  blocked_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_products_retailer on public.affiliate_products(retailer);
create index if not exists idx_products_category on public.affiliate_products(category_mapped);
create index if not exists idx_products_discount on public.affiliate_products(discount_pct desc)
  where in_stock and not is_blocked;
create index if not exists idx_products_last_seen on public.affiliate_products(last_seen_at);
create index if not exists idx_products_search on public.affiliate_products
  using gin(to_tsvector('danish', coalesce(product_name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(description,'')));

-- Touch updated_at on any update
create or replace function public.affiliate_products_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_affiliate_products_touch on public.affiliate_products;
create trigger trg_affiliate_products_touch
  before update on public.affiliate_products
  for each row execute function public.affiliate_products_touch_updated_at();

-- Category mapping from raw feed strings to internal taxonomy.
create table if not exists public.affiliate_category_mapping (
  retailer        text not null,
  category_raw    text not null,
  category_mapped text,
  whitelisted     boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (retailer, category_raw)
);

-- Sync run history (optional but useful for debug).
create table if not exists public.affiliate_sync_runs (
  id               bigserial primary key,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null check (status in ('running', 'success', 'failed')),
  retailer         text,
  products_total   integer,
  products_new     integer,
  products_updated integer,
  products_removed integer,
  error_message    text
);

-- RLS: public can read non-blocked products; mapping is publicly readable;
-- sync_runs is service-role-only; all writes require service role.
alter table public.affiliate_products enable row level security;
alter table public.affiliate_category_mapping enable row level security;
alter table public.affiliate_sync_runs enable row level security;

create policy "Public read non-blocked products"
  on public.affiliate_products for select
  using (is_blocked = false);

create policy "Public read category mapping"
  on public.affiliate_category_mapping for select
  using (true);

-- No public policies on affiliate_sync_runs — service role only.
