-- Add booking_mode to bookable_shelters
-- 'shelterdk' = booking hosted on shelterdk.dk/book/[slug]
-- 'iframe'    = booking embedded via iframe on owner's own website
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'iframe'
  CHECK (booking_mode IN ('shelterdk', 'iframe'));

-- Also add shelter_id column if it was not added by the first migration
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS shelter_id uuid REFERENCES shelters(id) ON DELETE SET NULL;
