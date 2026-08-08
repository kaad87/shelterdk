-- 056: luk de hemmelige kolonner på bookable_shelters for anon/authenticated
--
-- FUNDET UNDER QA 8/8-2026. `bookable_shelters` har præcis én RLS-policy:
--   "public read bookable_shelters"  SELECT  role public  USING (true)
-- dvs. ALLE kolonner var læsbare for enhver med anon-nøglen — og anon-nøglen
-- ligger i klient-bundlen, så den er reelt offentlig. Verificeret mod prod:
-- et anon-kald på /rest/v1/bookable_shelters?select=owner_token returnerede
-- gyldige tokens.
--
-- ALVOR: `owner_token` er ikke blot persondata, den er en adgangsnøgle. Den
-- gater /api/owner/[token]/* — bookings, accept/afvis, indstillinger, betalinger,
-- kalender, beskeder. Enhver kunne altså hente en ejers token og handle som
-- ejeren. `owner_email`, `notify_emails` og `ical_import_url` er persondata
-- henholdsvis en privat kalender-URL.
--
-- Skrivning var og er korrekt lukket: der findes INGEN INSERT/UPDATE/DELETE-
-- policy, så RLS afviser som standard (verificeret — anon-PATCH rammer 0 rækker).
--
-- FIX: kolonne-niveau-grants. Bemærk at table-niveau SELECT dækker alle kolonner
-- og skal fjernes FØRST, ellers har kolonne-grants ingen effekt.
--
-- Hvorfor ikke bare droppe policyen: forsiden og lib/new-shelters.ts læser
-- `bookable_shelters(id)` med anon-klienten for at afgøre om et shelter kan
-- bookes. Alle selects der rører de hemmelige kolonner bruger service_role,
-- som ikke berøres af disse grants.

revoke select on public.bookable_shelters from anon, authenticated;

grant select (
  id,
  slug,
  title,
  description,
  shelter_id,
  max_persons,
  created_at,
  booking_mode,
  ical_last_synced_at,
  shelter_price_dkk,
  platform_fee_pct,
  platform_fee_min_dkk,
  payment_mode,
  cancellation_cutoff_hours,
  same_day_booking_deadline
) on public.bookable_shelters to anon, authenticated;

-- Bevidst UDELADT (kun service_role): owner_email, owner_token, auth_user_id,
-- ical_import_url, notify_emails.
