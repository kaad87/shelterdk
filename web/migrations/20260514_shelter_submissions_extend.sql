-- migrations/20260514_shelter_submissions_extend.sql
ALTER TABLE shelter_submissions
  ADD COLUMN IF NOT EXISTS lat float8 null,
  ADD COLUMN IF NOT EXISTS lng float8 null,
  ADD COLUMN IF NOT EXISTS photo_urls text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS region_hint text null,
  ADD COLUMN IF NOT EXISTS kommune_hint text null,
  ADD COLUMN IF NOT EXISTS place_hint text null,
  ADD COLUMN IF NOT EXISTS shelter_id uuid null references shelters(id) on delete set null;
