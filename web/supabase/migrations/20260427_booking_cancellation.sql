-- 20260427_booking_cancellation.sql

-- Add cancellation fields to shelter_bookings
-- PostgreSQL 12+: NOT NULL DEFAULT backfills existing rows inline — no manual UPDATE needed.
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS guest_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('owner', 'guest', 'system'));
-- 'system' is reserved for future automated cancellation (e.g. post-expiry).
-- status CHECK constraint already includes 'cancelled' (see 20260424_booking_tables.sql).

CREATE UNIQUE INDEX IF NOT EXISTS shelter_bookings_guest_token_unique
  ON shelter_bookings (guest_token);

-- Add configurable refund cutoff to bookable_shelters (default: 48 hours)
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INT NOT NULL DEFAULT 48;
