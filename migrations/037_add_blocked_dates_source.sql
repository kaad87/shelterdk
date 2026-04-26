-- Add source column to shelter_blocked_dates
-- 'manual'    = blocked manually by owner via dashboard
-- 'ical_sync' = blocked automatically via iCal feed sync
ALTER TABLE shelter_blocked_dates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'ical_sync'));
