create table if not exists public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  category text not null default 'general',
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz default now() not null
);

alter table public.contact_messages enable row level security;

create policy "Anon can insert contact messages"
  on public.contact_messages
  for insert
  to anon
  with check (true);

comment on table public.contact_messages is
  'Kontaktbeskeder fra formularen på /kontakt. Læses i admin-panelet.';
