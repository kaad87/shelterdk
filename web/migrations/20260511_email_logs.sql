create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null default 'booking',
  email_type text not null,
  status text not null check (status in ('sent', 'failed')),
  provider text not null default 'resend',
  provider_message_id text null,
  to_email text not null,
  subject text not null,
  preview_text text null,
  booking_id uuid null,
  payment_id uuid null,
  shelter_id uuid null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_email_logs_created_at on public.email_logs (created_at desc);
create index if not exists idx_email_logs_status_created_at on public.email_logs (status, created_at desc);
create index if not exists idx_email_logs_category_created_at on public.email_logs (category, created_at desc);
create index if not exists idx_email_logs_booking_id on public.email_logs (booking_id);
create index if not exists idx_email_logs_payment_id on public.email_logs (payment_id);
create index if not exists idx_email_logs_shelter_id on public.email_logs (shelter_id);
create index if not exists idx_email_logs_email_type on public.email_logs (email_type);
