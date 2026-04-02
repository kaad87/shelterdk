-- Newsletter-tilmeldinger. Emails gemmes via service_role i API route.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'homepage',
  created_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_unique unique (email)
);

create index if not exists idx_newsletter_subscribers_created
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- Ingen offentlig adgang — alt går via service_role i API routes
