-- Add featured_sort_boost to manually pin shelters to the top of sorted lists.
-- Set to a high value (e.g. 99999) to guarantee top position on area/region/search pages.
ALTER TABLE shelters
  ADD COLUMN featured_sort_boost integer NOT NULL DEFAULT 0;

CREATE INDEX idx_shelters_featured_sort_boost ON shelters (featured_sort_boost DESC)
  WHERE featured_sort_boost > 0;
