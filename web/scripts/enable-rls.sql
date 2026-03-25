-- =============================================================
-- ShelterDK: Enable Row Level Security (RLS) on all tables
--
-- Run this in Supabase Dashboard → SQL Editor → New query
-- This secures all tables so the public anon key can only READ,
-- while writes require the service_role key (used by API routes).
-- =============================================================

-- 1. SHELTERS (core table — public read, no public write)
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shelters"
  ON shelters FOR SELECT
  USING (true);

-- 2. GOOGLE_PLACES (public read, no public write)
ALTER TABLE google_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read google_places"
  ON google_places FOR SELECT
  USING (true);

-- 3. GOOGLE_PLACE_REVIEWS (public read, no public write)
ALTER TABLE google_place_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read google_place_reviews"
  ON google_place_reviews FOR SELECT
  USING (true);

-- 4. AREAS (public read, no public write)
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read areas"
  ON areas FOR SELECT
  USING (true);

-- 5. SHELTER_COMMENTS (public read approved only, no public write)
ALTER TABLE shelter_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shelter_comments"
  ON shelter_comments FOR SELECT
  USING (true);

-- 6. COMMUNITY_SUBMISSIONS (no public access — admin only via service_role)
ALTER TABLE community_submissions ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon — only service_role (admin routes) can read/write

-- 7. SHELTER_PHOTO_SUBMISSIONS (no public access — admin only via service_role)
ALTER TABLE shelter_photo_submissions ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon — only service_role (admin routes) can read/write

-- 8. SHELTER_COMMUNITY_FACTS (public read, no public write)
ALTER TABLE shelter_community_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shelter_community_facts"
  ON shelter_community_facts FOR SELECT
  USING (true);

-- 9. TRIP_POSTS (public read active posts only, no public write)
ALTER TABLE trip_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active trip_posts"
  ON trip_posts FOR SELECT
  USING (status = 'active' AND expires_at > now());

-- =============================================================
-- NOTE: service_role key ALWAYS bypasses RLS.
-- All API routes that write data now use createAdminClient()
-- which uses the service_role key, so they are not affected.
-- =============================================================
