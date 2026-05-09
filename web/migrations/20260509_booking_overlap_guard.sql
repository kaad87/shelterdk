create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shelter_bookings_no_overlap_active'
  ) then
    alter table public.shelter_bookings
      add constraint shelter_bookings_no_overlap_active
      exclude using gist (
        bookable_shelter_id with =,
        daterange(check_in, check_out, '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end $$;
