-- Bookable shelters (private shelters registered for booking on ShelterDK)
CREATE TABLE IF NOT EXISTS bookable_shelters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  shelter_id      uuid REFERENCES shelters(id) ON DELETE SET NULL,
  owner_email     text NOT NULL,
  owner_token     uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  max_persons     int NOT NULL DEFAULT 6,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Booking requests from guests
CREATE TABLE IF NOT EXISTS shelter_bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookable_shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  guest_name            text NOT NULL,
  guest_email           text NOT NULL,
  guest_count           int NOT NULL,
  check_in              date NOT NULL,
  check_out             date NOT NULL,
  message               text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','rejected','cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Single-use tokens for email accept/reject links
CREATE TABLE IF NOT EXISTS booking_action_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('confirm','reject')),
  token       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

-- Owner-blocked dates (e.g. "we are using it ourselves")
CREATE TABLE IF NOT EXISTS shelter_blocked_dates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookable_shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  blocked_date          date NOT NULL,
  reason                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bookable_shelter_id, blocked_date)
);

-- RLS: alle tabeller er public read, kun service_role må skrive
ALTER TABLE bookable_shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read bookable_shelters"
  ON bookable_shelters FOR SELECT USING (true);

CREATE POLICY "public read shelter_bookings"
  ON shelter_bookings FOR SELECT USING (true);

CREATE POLICY "public read shelter_blocked_dates"
  ON shelter_blocked_dates FOR SELECT USING (true);

-- booking_action_tokens: ingen public read (tokens er hemmelige)
-- Alle writes sker via service_role i API routes (bypasser RLS)

-- Index til availability-forespørgslen (hot path: hentes ved hvert kald til booking-siden)
CREATE INDEX IF NOT EXISTS idx_shelter_bookings_availability
  ON shelter_bookings (bookable_shelter_id, status, check_out);
