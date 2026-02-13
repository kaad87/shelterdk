-- Brugerupload af shelter-billeder med godkendelseskø.

-- Godkendte brugerbilleder på shelteret (URL'er fra Storage efter godkendelse).
alter table public.shelters
  add column if not exists user_image_urls jsonb default null;

comment on column public.shelters.user_image_urls is 'URL-er til godkendte brugeruploadede billeder (fx fra Supabase Storage).';

-- Kø af indsendte billeder (venter på godkendelse).
create table if not exists public.shelter_photo_submissions (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  file_path text not null,
  storage_bucket text not null default 'shelter-photos',
  submitter_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  review_notes text
);

create index if not exists idx_shelter_photo_submissions_shelter
  on public.shelter_photo_submissions(shelter_id);
create index if not exists idx_shelter_photo_submissions_status
  on public.shelter_photo_submissions(status);

alter table public.shelter_photo_submissions enable row level security;

create policy "Alle kan læse submissions"
  on public.shelter_photo_submissions for select using (true);
create policy "Alle kan indsætte (upload)"
  on public.shelter_photo_submissions for insert with check (true);
create policy "Opdatering tilladt (godkendelse sker via admin-API beskyttet af hemmelighed)"
  on public.shelter_photo_submissions for update using (true);

comment on table public.shelter_photo_submissions is 'Brugeruploadede shelter-billeder – venter på godkendelse. Efter godkendelse tilføjes URL til shelters.user_image_urls.';

-- Opret Storage-bucket "shelter-photos" i Supabase Dashboard:
--   Storage → New bucket → navn "shelter-photos" → Public.
--   Policies: (1) Allow anon INSERT til "pending/*", (2) Allow public SELECT (read) for alle.
--
-- I web/.env.local: sæt ADMIN_SECRET til en hemmelig kode til /admin/billeder (godkendelse af billeder).
