-- web/migrations/20260419_shelter_submissions.sql

CREATE TYPE submission_type AS ENUM ('owner_registration', 'user_tip');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE shelter_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            submission_type NOT NULL,
  status          submission_status NOT NULL DEFAULT 'pending',

  -- Required for both flows
  shelter_name    text NOT NULL CHECK (char_length(shelter_name) > 0 AND char_length(shelter_name) <= 200),
  location_text   text NOT NULL CHECK (char_length(location_text) > 0 AND char_length(location_text) <= 200),

  -- Extended info (Flow 1)
  capacity        integer         CHECK (capacity IS NULL OR capacity > 0),
  description     text,
  facilities      jsonb,          -- keys: vand, toilet, baalplads, parkering, hund (booleans)
  booking_url     text,

  -- Contact (Flow 1)
  contact_name    text,
  contact_email   text            CHECK (type != 'owner_registration' OR contact_email IS NOT NULL),

  -- Extra info (Flow 2)
  source_info     text            CHECK (source_info IS NULL OR char_length(source_info) <= 500),

  -- Admin
  admin_note      text,
  rejected_reason text,
  reviewed_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- No public policy — only service_role can read/write
ALTER TABLE shelter_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_shelter_submissions_status ON shelter_submissions(status);
CREATE INDEX idx_shelter_submissions_created ON shelter_submissions(created_at DESC) WHERE status = 'pending';
