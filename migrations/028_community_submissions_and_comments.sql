-- Community-drevet indhold: kommentarer + facilitetsforslag med moderation.

create table if not exists public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  type text not null check (type in ('comment', 'facilities_update')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitter_name text,
  submitter_email text,
  submitter_user_id uuid,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_community_submissions_shelter_id
  on public.community_submissions (shelter_id);
create index if not exists idx_community_submissions_status
  on public.community_submissions (status);
create index if not exists idx_community_submissions_type
  on public.community_submissions (type);

create table if not exists public.shelter_comments (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  author_name text not null,
  comment_text text not null,
  source_submission_id uuid references public.community_submissions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shelter_comments_shelter_id
  on public.shelter_comments (shelter_id, created_at desc);

-- Godkendte, community-afledte facilitetsvaerdier.
create table if not exists public.shelter_community_facts (
  shelter_id uuid primary key references public.shelters(id) on delete cascade,
  toilet text check (toilet in ('yes', 'no', 'unknown')),
  parkering text check (parkering in ('yes', 'no', 'unknown')),
  baalplads text check (baalplads in ('yes', 'no', 'unknown')),
  legeplads text check (legeplads in ('yes', 'no', 'unknown')),
  fiskeri text check (fiskeri in ('yes', 'no', 'unknown')),
  vand text check (vand in ('yes', 'no', 'unknown')),
  teltplads text check (teltplads in ('yes', 'no', 'unknown')),
  hund text check (hund in ('yes', 'no', 'unknown')),
  hest text check (hest in ('yes', 'no', 'unknown')),
  braende text check (braende in ('yes', 'no', 'unknown')),
  bad text check (bad in ('yes', 'no', 'unknown')),
  elektricitet text check (elektricitet in ('yes', 'no', 'unknown')),
  koeleskab text check (koeleskab in ('yes', 'no', 'unknown')),
  updated_at timestamptz not null default now()
);

alter table public.community_submissions enable row level security;
alter table public.shelter_comments enable row level security;
alter table public.shelter_community_facts enable row level security;

create policy "Alle kan laese shelter_comments"
  on public.shelter_comments for select using (true);
create policy "Alle kan indsende community_submissions"
  on public.community_submissions for insert with check (true);
create policy "Alle kan laese community_submissions"
  on public.community_submissions for select using (true);
create policy "Opdatering tilladt via admin-api"
  on public.community_submissions for update using (true);
create policy "Alle kan laese shelter_community_facts"
  on public.shelter_community_facts for select using (true);
create policy "Opdatering tilladt via admin-api"
  on public.shelter_community_facts for all using (true) with check (true);

comment on table public.community_submissions is 'Moderationskoe for community-indsendelser (kommentarer + facilitetsopdateringer).';
comment on table public.shelter_comments is 'Godkendte community-kommentarer, vises offentligt.';
comment on table public.shelter_community_facts is 'Godkendte community-facilitetsvaerdier pr shelter.';
