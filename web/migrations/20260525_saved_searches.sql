-- F11: Save search + email alerts
-- Brugere kan gemme en søgning og få besked på e-mail når nye shelters
-- matcher kriterierne. Bekræftelses-flow (double-opt-in) + one-click
-- unsubscribe via token.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  /** Region-filter (Jylland, Sjælland og Øerne, Fyn, Bornholm) eller null = hele DK. */
  region text,
  /** Fritekstsøgning fra /soeg?q=... */
  q text,
  /** Area-slug fra /soeg?area=... */
  area text,
  /** Resterende filtre (bookbar, vand, toilet, ...) gemt som JSONB. */
  filters jsonb not null default '{}'::jsonb,
  /** Random URL-safe token brugt i confirm + unsubscribe-links. */
  token text not null unique check (char_length(token) between 16 and 64),
  /** Sættes når bruger klikker confirm-link i e-mail (double-opt-in). */
  confirmed_at timestamptz,
  /** Sidst kørt af cron — bruges til at finde "nye matches siden". */
  last_run_at timestamptz,
  /** Sidst sendte alert-mail (for at undgå spam ved flere kørsler). */
  last_notified_at timestamptz,
  /** Antal gange alert er sendt — for analytics. */
  notify_count int not null default 0,
  created_at timestamptz not null default now(),
  /** Audit. */
  ip_address text,
  user_agent text
);

create index if not exists saved_searches_email_idx on public.saved_searches(email);
create index if not exists saved_searches_confirmed_idx
  on public.saved_searches(confirmed_at)
  where confirmed_at is not null;
create index if not exists saved_searches_region_idx on public.saved_searches(region);

-- RLS: tabellen tilgås kun via service role (admin client). Aktiver RLS uden
-- policies så anon/auth ikke kan læse.
alter table public.saved_searches enable row level security;
