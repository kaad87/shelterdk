-- Migration 035: Payment system tables
-- Adds pricing fields to bookable_shelters, booking_payments, and owner_payouts

-- Pricing fields on bookable_shelters
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS shelter_price_dkk    integer       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_pct     decimal(5,2)  NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS platform_fee_min_dkk integer       NOT NULL DEFAULT 25;

-- Payment tracking per booking
CREATE TABLE IF NOT EXISTS booking_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  uuid NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  stripe_checkout_session_id  text NOT NULL UNIQUE,
  amount_total_dkk            integer NOT NULL,
  amount_shelter_dkk          integer NOT NULL,
  amount_platform_dkk         integer NOT NULL,
  status                      text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed','expired')),
  payment_link_sent_at        timestamptz,
  paid_at                     timestamptz,
  expires_at                  timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_payments_booking_id_idx
  ON booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS booking_payments_status_expires_idx
  ON booking_payments(status, expires_at);

-- Owner payout tracking
CREATE TABLE IF NOT EXISTS owner_payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  amount_dkk   integer NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
