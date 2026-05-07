-- Track whether a booking came from the public guest flow or was created manually by an owner.
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'guest'
  CHECK (source IN ('guest', 'owner_manual'));
