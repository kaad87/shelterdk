-- migrations/20260514_shelter_submissions_wants_booking.sql
-- Run in Supabase SQL editor before deploying booking signup flow (Tasks 3 and 7)
ALTER TABLE shelter_submissions
  ADD COLUMN IF NOT EXISTS wants_booking boolean not null default false;
