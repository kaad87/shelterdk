CREATE TABLE IF NOT EXISTS owner_claim_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id  uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_claim_tokens_shelter_id
  ON owner_claim_tokens (shelter_id);

CREATE INDEX IF NOT EXISTS idx_owner_claim_tokens_expires_at
  ON owner_claim_tokens (expires_at);
