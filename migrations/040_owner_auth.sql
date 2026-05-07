-- migrations/040_owner_auth.sql
-- Adds auth_user_id to bookable_shelters so owners can log in with Supabase Auth.
-- Nullable — existing shelters start with NULL and get linked when the owner signs up.

ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN bookable_shelters.auth_user_id IS
  'Links this shelter to a Supabase Auth user. Set when the owner proves ownership and signs up.';

CREATE INDEX IF NOT EXISTS bookable_shelters_auth_user_id_idx
  ON bookable_shelters (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
