-- migrations/050_booking_no_overlap_constraint.sql
-- Hard guarantee against double-booking.
--
-- Background: createBooking() in lib/booking-db.ts already handles Postgres error
-- 23P01 (exclusion_violation), but the constraint was never created — so the only
-- guard was the app-level hasUnavailableOverlap() check (SELECT-then-INSERT), which
-- has a TOCTOU race: two concurrent requests can both pass the check and both insert,
-- producing an overlapping (double) booking. This adds the DB-level guarantee and
-- makes the existing 23P01 handling live.
--
-- Scope: only pending + confirmed bookings reserve dates. Cancelled/rejected bookings
-- drop out of the partial index, freeing the dates for re-booking. Date range is
-- half-open [check_in, check_out) — a check_out on day X does NOT collide with a
-- check_in on day X (matches hasUnavailableOverlap's `check_in < check_out` logic).
--
-- Pre-check (run first; must return 0 rows, or the ALTER will fail):
--   SELECT a.id, b.id, a.bookable_shelter_id, a.check_in, a.check_out
--   FROM shelter_bookings a
--   JOIN shelter_bookings b
--     ON a.bookable_shelter_id = b.bookable_shelter_id
--    AND a.id < b.id
--    AND a.status IN ('pending','confirmed')
--    AND b.status IN ('pending','confirmed')
--    AND daterange(a.check_in, a.check_out, '[)') && daterange(b.check_in, b.check_out, '[)');
-- (Verified empirically on 2026-06-24: 0 existing overlaps.)

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE shelter_bookings
  ADD CONSTRAINT shelter_bookings_no_overlap
  EXCLUDE USING gist (
    bookable_shelter_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));
