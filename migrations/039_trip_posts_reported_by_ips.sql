-- Add reported_by_ips column to trip_posts for IP-based report deduplication
ALTER TABLE trip_posts
  ADD COLUMN IF NOT EXISTS reported_by_ips TEXT[] NOT NULL DEFAULT '{}';
