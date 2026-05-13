create table if not exists public.custom_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null,
  destination_url text not null,
  status_code integer not null default 302,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_redirects_source_path_check check (left(source_path, 1) = '/'),
  constraint custom_redirects_status_code_check check (status_code in (301, 302, 307, 308)),
  constraint custom_redirects_destination_check check (
    left(destination_url, 1) = '/'
    or destination_url ilike 'https://%'
    or destination_url ilike 'http://%'
  )
);

create unique index if not exists custom_redirects_source_path_key
  on public.custom_redirects (source_path);

create index if not exists custom_redirects_active_source_idx
  on public.custom_redirects (is_active, source_path);

alter table public.custom_redirects enable row level security;

drop policy if exists "Public can read active redirects" on public.custom_redirects;
create policy "Public can read active redirects"
  on public.custom_redirects
  for select
  using (is_active = true);
