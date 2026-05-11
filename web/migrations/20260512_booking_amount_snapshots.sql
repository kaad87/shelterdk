alter table public.shelter_bookings
  add column if not exists quoted_shelter_dkk integer,
  add column if not exists quoted_platform_dkk integer,
  add column if not exists quoted_total_dkk integer;
