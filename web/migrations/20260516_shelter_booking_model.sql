alter table public.shelters
  add column if not exists booking_provider text,
  add column if not exists booking_link_mode text,
  add column if not exists booking_lookup_key text,
  add column if not exists booking_url_verified_at timestamptz,
  add column if not exists booking_confidence text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_booking_provider_check'
  ) then
    alter table public.shelters
      add constraint shelters_booking_provider_check
      check (
        booking_provider is null or booking_provider in (
          'shelterdk',
          'naturstyrelsen',
          'udinaturen',
          'kommune',
          'private',
          'unknown'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_booking_link_mode_check'
  ) then
    alter table public.shelters
      add constraint shelters_booking_link_mode_check
      check (
        booking_link_mode is null or booking_link_mode in (
          'internal',
          'external_direct',
          'external_search',
          'contact_only',
          'first_come'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelters_booking_confidence_check'
  ) then
    alter table public.shelters
      add constraint shelters_booking_confidence_check
      check (
        booking_confidence is null or booking_confidence in (
          'manual',
          'verified_match',
          'imported',
          'heuristic'
        )
      );
  end if;
end $$;

create index if not exists shelters_booking_provider_idx
  on public.shelters (booking_provider);

create index if not exists shelters_booking_link_mode_idx
  on public.shelters (booking_link_mode);

create index if not exists shelters_booking_lookup_key_idx
  on public.shelters (booking_lookup_key);
