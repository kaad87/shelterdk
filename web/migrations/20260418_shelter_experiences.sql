-- Enum for experience status
CREATE TYPE experience_status AS ENUM ('pending', 'approved', 'rejected');

-- Main table
CREATE TABLE shelter_experiences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id         UUID NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  author_name        TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 60),
  body               TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  photo_urls         TEXT[] NOT NULL DEFAULT '{}',
  cover_photo_index  INTEGER NOT NULL DEFAULT 0 CHECK (cover_photo_index >= 0),
  status             experience_status NOT NULL DEFAULT 'pending',
  rejected_reason    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ
);

-- RLS: public can only read approved rows
ALTER TABLE shelter_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved"
  ON shelter_experiences FOR SELECT
  USING (status = 'approved');

-- Service role can do everything (used by API routes via createAdminClient)
-- No explicit policy needed — service_role bypasses RLS.

-- Index for shelter lookups
CREATE INDEX idx_shelter_experiences_shelter_id
  ON shelter_experiences (shelter_id)
  WHERE status = 'approved';

-- Index for admin pending queue
CREATE INDEX idx_shelter_experiences_pending
  ON shelter_experiences (created_at DESC)
  WHERE status = 'pending';
