-- Kuraterede Instagram-opslag til widget (blog + fakta). Admin godkender via service role.

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  post_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint instagram_posts_post_url_unique unique (post_url)
);

create index if not exists idx_instagram_posts_status_created
  on public.instagram_posts (status, created_at desc);

create index if not exists idx_instagram_posts_approved_reviewed
  on public.instagram_posts (reviewed_at desc nulls last)
  where status = 'approved';

alter table public.instagram_posts enable row level security;

-- Offentlig læsning: kun godkendte opslag (widget + feed-API med anon key)
create policy "Public can read approved instagram posts"
  on public.instagram_posts
  for select
  to anon, authenticated
  using (status = 'approved');

-- Ingen insert/update/delete for anon — admin bruger service_role i API routes
