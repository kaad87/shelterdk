-- =============================================================
-- ShelterDK · 045 Complete RLS lockdown
--
-- KRITISK SIKKERHEDS-FIX: Tabeller der ikke havde RLS aktiveret
-- har eksponeret owner_token, guest_email, guest_name og andre PII
-- via Supabase REST-API'et med anon-nøglen.
--
-- Dette script:
--   1. Aktiverer RLS på ALLE relevante tabeller (idempotent)
--   2. Tilføjer eksplicitte SELECT-policies hvor offentlig læseadgang
--      er ønsket (shelters, areas, ratings osv.)
--   3. Tilføjer ingen policies for tabeller med PII → kun service_role
--      (server-side admin client) har adgang
--
-- Service_role-nøglen bypasser ALTID RLS, så alle API-routes der
-- bruger createAdminClient() fungerer uændret.
--
-- KØR I SUPABASE DASHBOARD → SQL EDITOR → NEW QUERY
-- =============================================================

BEGIN;

-- ─── 1. Public-read tables (RLS + open SELECT-policy) ───────────

ALTER TABLE IF EXISTS shelters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelters" ON shelters;
CREATE POLICY "Anyone can read shelters" ON shelters FOR SELECT USING (true);

ALTER TABLE IF EXISTS google_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read google_places" ON google_places;
CREATE POLICY "Anyone can read google_places" ON google_places FOR SELECT USING (true);

ALTER TABLE IF EXISTS google_place_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read google_place_reviews" ON google_place_reviews;
CREATE POLICY "Anyone can read google_place_reviews" ON google_place_reviews FOR SELECT USING (true);

ALTER TABLE IF EXISTS areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read areas" ON areas;
CREATE POLICY "Anyone can read areas" ON areas FOR SELECT USING (true);

ALTER TABLE IF EXISTS shelter_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_comments" ON shelter_comments;
CREATE POLICY "Anyone can read shelter_comments" ON shelter_comments FOR SELECT USING (true);

ALTER TABLE IF EXISTS shelter_community_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_community_facts" ON shelter_community_facts;
CREATE POLICY "Anyone can read shelter_community_facts" ON shelter_community_facts FOR SELECT USING (true);

ALTER TABLE IF EXISTS trip_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active trip_posts" ON trip_posts;
CREATE POLICY "Anyone can read active trip_posts" ON trip_posts
  FOR SELECT USING (status = 'active' AND expires_at > now());

ALTER TABLE IF EXISTS affiliate_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read affiliate_products" ON affiliate_products;
CREATE POLICY "Anyone can read affiliate_products" ON affiliate_products FOR SELECT USING (true);

ALTER TABLE IF EXISTS instagram_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read approved instagram_posts" ON instagram_posts;
-- Only show approved posts publicly; service_role can still see all
CREATE POLICY "Anyone can read approved instagram_posts" ON instagram_posts
  FOR SELECT USING (status = 'approved');

ALTER TABLE IF EXISTS shelter_google_match ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_google_match" ON shelter_google_match;
CREATE POLICY "Anyone can read shelter_google_match" ON shelter_google_match FOR SELECT USING (true);

ALTER TABLE IF EXISTS affiliate_category_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read affiliate_category_mapping" ON affiliate_category_mapping;
CREATE POLICY "Anyone can read affiliate_category_mapping" ON affiliate_category_mapping FOR SELECT USING (true);

-- ─── 2. PRIVATE / PII tables (RLS, NO policies → service_role only) ───

ALTER TABLE IF EXISTS bookable_shelters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read bookable_shelters" ON bookable_shelters;
-- Note: We expose select bookable_shelters data publicly via the API
-- (e.g. on shelter detail pages) but always via server-side queries that
-- omit owner_token + auth_user_id. Anon SDK access stays locked.

ALTER TABLE IF EXISTS shelter_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_bookings" ON shelter_bookings;

ALTER TABLE IF EXISTS booking_action_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read booking_action_tokens" ON booking_action_tokens;

ALTER TABLE IF EXISTS shelter_blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_blocked_dates" ON shelter_blocked_dates;

ALTER TABLE IF EXISTS booking_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read booking_payments" ON booking_payments;

ALTER TABLE IF EXISTS owner_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read owner_payouts" ON owner_payouts;

ALTER TABLE IF EXISTS booking_monitor_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read booking_monitor_events" ON booking_monitor_events;

ALTER TABLE IF EXISTS external_availability_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read external_availability_days" ON external_availability_days;

ALTER TABLE IF EXISTS external_availability_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read external_availability_snapshots" ON external_availability_snapshots;

ALTER TABLE IF EXISTS contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Anyone can insert contact_messages" ON contact_messages;
-- POSTs go through /api/contact (rate-limited) using service_role; no direct anon insert.

ALTER TABLE IF EXISTS community_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read community_submissions" ON community_submissions;

ALTER TABLE IF EXISTS shelter_photo_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_photo_submissions" ON shelter_photo_submissions;

ALTER TABLE IF EXISTS newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read newsletter_subscribers" ON newsletter_subscribers;

ALTER TABLE IF EXISTS shelter_booking_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read shelter_booking_messages" ON shelter_booking_messages;

ALTER TABLE IF EXISTS booking_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read booking_messages" ON booking_messages;

ALTER TABLE IF EXISTS booking_message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read booking_message_templates" ON booking_message_templates;

ALTER TABLE IF EXISTS owner_claim_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read owner_claim_tokens" ON owner_claim_tokens;

ALTER TABLE IF EXISTS public_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read public_rate_limits" ON public_rate_limits;

ALTER TABLE IF EXISTS experiences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read approved experiences" ON experiences;
-- Public reads of experiences happen via server-side admin queries that
-- filter on approved status; anon SDK reads stay locked to avoid leaking
-- moderation queue items.

ALTER TABLE IF EXISTS bookenshelter_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read bookenshelter_raw" ON bookenshelter_raw;

ALTER TABLE IF EXISTS naturstyrelsen_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read naturstyrelsen_raw" ON naturstyrelsen_raw;

ALTER TABLE IF EXISTS affiliate_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read affiliate_sync_runs" ON affiliate_sync_runs;

COMMIT;

-- =============================================================
-- VERIFY EFTER KØRSEL
--
-- Kør denne query for at se hvilke tabeller stadig har RLS deaktiveret:
--
--   SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false
--   ORDER BY tablename;
--
-- Forventet resultat: 0 rækker. Hvis nogen vises, så manuelt aktivér
-- dem med ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;
-- =============================================================
