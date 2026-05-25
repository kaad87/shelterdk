create table if not exists public.shelter_booking_reviews (
  shelter_id uuid primary key references public.shelters(id) on delete cascade,
  status text not null check (status in ('booking_found', 'contact_only', 'not_bookable', 'needs_manual')),
  notes text,
  reviewed_booking_url text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists shelter_booking_reviews_status_idx
  on public.shelter_booking_reviews(status);
