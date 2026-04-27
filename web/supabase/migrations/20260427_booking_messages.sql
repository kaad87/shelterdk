CREATE TABLE IF NOT EXISTS booking_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  sender     TEXT        NOT NULL CHECK (sender IN ('guest', 'owner')),
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ           -- NULL = ulæst af modtageren
);

CREATE INDEX IF NOT EXISTS booking_messages_booking_created
  ON booking_messages(booking_id, created_at);
