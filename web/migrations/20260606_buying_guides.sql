-- Buyer-intent købsguider (affiliate).
-- Adskiller live produktdata (affiliate_products) fra redaktionel rangering.
-- Spec: docs/superpowers/specs/2026-06-06-buyer-intent-buying-guides-design.md

-- 1) Strukturerede specs + redaktionel score på produkter.
alter table public.affiliate_products
  add column if not exists specs jsonb,
  add column if not exists editor_score numeric;

-- 2) Selve guiden.
create table if not exists public.buying_guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,                 -- matcher affiliate_products.category_mapped
  intro text,                             -- kort ingress
  body_md text,                           -- lang købsguide-brødtekst (markdown, renderes via renderContent)
  sources jsonb,                          -- [{title, url}] eksterne tests/kilder
  faq jsonb,                              -- [{q, a}] synlig FAQ + FAQPage-schema
  seo_title text,
  seo_description text,
  hero_image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Rangerede produkter i guiden.
create table if not exists public.buying_guide_entries (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.buying_guides(id) on delete cascade,
  affiliate_product_id uuid not null references public.affiliate_products(id) on delete cascade,
  rank int not null default 0,
  award_label text,                       -- 'Bedst i test'|'Bedste budget'|'Bedste letvægt'|'Bedste til vinter'...
  editorial_note text,                    -- "derfor anbefaler vi"
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (guide_id, affiliate_product_id)
);

create index if not exists idx_bge_guide on public.buying_guide_entries(guide_id, rank);
create index if not exists idx_bg_status on public.buying_guides(status);

-- RLS: offentlig læsning af publicerede guider + deres entries. Skrivning kun service-role.
alter table public.buying_guides enable row level security;
alter table public.buying_guide_entries enable row level security;

drop policy if exists "public read published guides" on public.buying_guides;
create policy "public read published guides" on public.buying_guides
  for select using (status = 'published');

drop policy if exists "public read entries of published guides" on public.buying_guide_entries;
create policy "public read entries of published guides" on public.buying_guide_entries
  for select using (
    exists (select 1 from public.buying_guides g
            where g.id = guide_id and g.status = 'published')
  );

-- updated_at-trigger (følger per-tabel konvention fra 034_affiliate_products.sql).
create or replace function public.buying_guides_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_buying_guides_touch on public.buying_guides;
create trigger trg_buying_guides_touch
  before update on public.buying_guides
  for each row execute function public.buying_guides_touch_updated_at();
