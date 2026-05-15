ALTER TABLE shelters
  ADD COLUMN IF NOT EXISTS featured_sort_boost integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shelters_featured_sort_boost
  ON shelters (featured_sort_boost DESC)
  WHERE featured_sort_boost > 0;
