-- Egne events der aldrig når GA4.
--
-- /api/track sender events to steder: direkte til GA4 via Measurement Protocol,
-- og — for affiliate-klik — til affiliate_clicks. GA4-vejen er bag en
-- samtykkeport (lib/server-analytics.ts: kræver consent-cookien "analytics"
-- eller "marketing"), og cookien sættes først når nogen trykker i banneret.
-- Resultatet er målt: affiliate_click står til 7 i GA4 mod 222 i
-- affiliate_clicks over samme 28 dage — altså ~3%.
--
-- gear_suggestion_click havde samme problem og var dermed ubrugelig til det,
-- den blev lavet til: at afgøre om grej-blokken på de 1.609 shelter-sider
-- overhovedet bruges. Tabellen her giver den samme fulde optælling som
-- affiliate_clicks, på samme anonyme grundlag.
--
-- Anonymitet: ingen IP, ingen user-agent, ingen bruger- eller sessions-id.
-- Kun eventnavn, sti og ikke-identificerende parametre. Samme grundlag som
-- affiliate_clicks, der har kørt siden juni.
--
-- RLS slås til UDEN policies — præcis som affiliate_clicks. Writes sker fra
-- /api/track med service_role, der omgår RLS. Tilføj aldrig en always-true
-- write-policy her.

create table if not exists public.internal_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,
  path text,
  -- Eventets egne parametre, fx {"guide_slug":"sovepose","shelter_slug":"..."}.
  -- Jsonb frem for kolonner, så nye events ikke kræver en migration.
  params jsonb not null default '{}'::jsonb
);

comment on table public.internal_events is
  'Egne events logget uden samtykkeport (anonymt). GA4 ser kun ~3% pga. consent-gaten i server-analytics.ts.';

create index if not exists idx_internal_events_event_created
  on public.internal_events (event, created_at desc);

alter table public.internal_events enable row level security;
