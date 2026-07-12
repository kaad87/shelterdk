-- migrations/053_guest_reviews.sql
-- Førsteparts gæste-anmeldelser efter ophold (P2 i AEO-planen).
-- Flow: dagligt cron finder bookinger med overstået check_out → mail med
-- /anmeld/<guest_token>-link → gæsten giver 1-5 stjerner + valgfri tekst →
-- server-renderes på shelter-siden + aggregateRating i schema.
-- Ærligt: kun rigtige, verificerede ophold (unik pr. booking) — aldrig fabrikeret.

CREATE TABLE IF NOT EXISTS shelter_guest_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL UNIQUE REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  bookable_shelter_id uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  -- Denormaliseret til visning på den offentlige shelter-side (undgår join-kæde).
  shelter_id  uuid REFERENCES shelters(id) ON DELETE SET NULL,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  guest_name  text NOT NULL,
  status      text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_reviews_shelter_id
  ON shelter_guest_reviews (shelter_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_guest_reviews_bookable_shelter_id
  ON shelter_guest_reviews (bookable_shelter_id);

-- RLS: offentlig læsning af publicerede; ALLE writes via service_role (se
-- feedback_no_anon_write_rls — aldrig anon write-policies).
ALTER TABLE shelter_guest_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Publicerede anmeldelser er offentligt læsbare" ON shelter_guest_reviews;
CREATE POLICY "Publicerede anmeldelser er offentligt læsbare"
  ON shelter_guest_reviews FOR SELECT
  USING (status = 'published');

-- Markør så anmodnings-mailen kun sendes én gang pr. booking.
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;
