-- 036_add_payment_mode.sql
ALTER TABLE bookable_shelters
  ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'after_confirmation'
  CHECK (payment_mode IN ('after_confirmation', 'upfront'));

COMMENT ON COLUMN bookable_shelters.payment_mode IS
  'after_confirmation: guest requests, owner confirms, then guest pays. upfront: guest pays immediately, owner confirms or refunds.';
