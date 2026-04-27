-- 040_booking_message_templates.sql
-- Owner-editable templates for automatic booking emails

CREATE TABLE IF NOT EXISTS booking_message_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id              UUID NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  confirmation_enabled    BOOLEAN NOT NULL DEFAULT true,
  confirmation_subject    TEXT NOT NULL DEFAULT '',
  confirmation_body       TEXT NOT NULL DEFAULT '',
  reminder_enabled        BOOLEAN NOT NULL DEFAULT true,
  reminder_subject        TEXT NOT NULL DEFAULT '',
  reminder_body           TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shelter_id)
);

-- Reuse existing set_updated_at() trigger function (defined in schema.sql).
-- Note: the spec mentions "update_updated_at_column" but the codebase uses "set_updated_at".
-- Verify the function exists: SELECT proname FROM pg_proc WHERE proname = 'set_updated_at';
CREATE TRIGGER booking_message_templates_updated_at
  BEFORE UPDATE ON booking_message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Idempotency: prevents double-send if cron restarts mid-run
ALTER TABLE shelter_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
