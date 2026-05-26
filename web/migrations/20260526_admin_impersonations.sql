-- Admin "Log ind som ejer" — audit-table.
--
-- Hver gang en admin genererer et magic-link til en ejer, logges
-- handlingen her. Selve auth-flow'et (login med magic-link) logges
-- også af Supabase i auth.audit_log_entries — den her tabel giver os
-- en lokal cross-reference med IP, user-agent og hvilken shelter
-- handlingen var for.

create table if not exists public.admin_impersonations (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text not null,
  /** Hvilken bookable_shelter admin'en kiggede på da han trykkede login. */
  target_shelter_id uuid references public.bookable_shelters(id) on delete set null,
  admin_ip text,
  admin_user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_impersonations_created_at_idx
  on public.admin_impersonations(created_at desc);
create index if not exists admin_impersonations_target_user_idx
  on public.admin_impersonations(target_user_id);

-- Service-role only. Aktiver RLS uden policies.
alter table public.admin_impersonations enable row level security;
