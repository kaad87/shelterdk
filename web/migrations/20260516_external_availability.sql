alter table public.shelters
  add column if not exists availability_provider text,
  add column if not exists availability_mode text,
  add column if not exists availability_lookup_key text,
  add column if not exists availability_url text,
  add column if not exists availability_verified_at timestamptz,
  add column if not exists availability_confidence text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_availability_provider_check'
  ) then
    alter table public.shelters
      add constraint shelters_availability_provider_check
      check (
        availability_provider is null or availability_provider in (
          'shelterdk',
          'naturstyrelsen',
          'unknown'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_availability_mode_check'
  ) then
    alter table public.shelters
      add constraint shelters_availability_mode_check
      check (
        availability_mode is null or availability_mode in (
          'internal_live',
          'external_cached',
          'external_unknown',
          'none'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_availability_confidence_check'
  ) then
    alter table public.shelters
      add constraint shelters_availability_confidence_check
      check (
        availability_confidence is null or availability_confidence in (
          'manual',
          'verified_match',
          'imported',
          'heuristic'
        )
      );
  end if;
end $$;

create index if not exists shelters_availability_provider_idx
  on public.shelters (availability_provider);

create index if not exists shelters_availability_mode_idx
  on public.shelters (availability_mode);

create index if not exists shelters_availability_lookup_key_idx
  on public.shelters (availability_lookup_key);

create table if not exists public.external_availability_snapshots (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  provider text not null,
  lookup_key text not null,
  as_of_date date not null,
  fetched_at timestamptz not null default now(),
  status text not null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists external_availability_snapshots_shelter_id_idx
  on public.external_availability_snapshots (shelter_id, fetched_at desc);

create index if not exists external_availability_snapshots_provider_lookup_idx
  on public.external_availability_snapshots (provider, lookup_key, fetched_at desc);

create table if not exists public.external_availability_days (
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  provider text not null,
  day date not null,
  state text not null,
  fetched_at timestamptz not null default now(),
  primary key (shelter_id, provider, day)
);

create index if not exists external_availability_days_day_state_idx
  on public.external_availability_days (day, state);

create index if not exists external_availability_days_shelter_day_idx
  on public.external_availability_days (shelter_id, day);

create index if not exists external_availability_days_provider_day_idx
  on public.external_availability_days (provider, day);
