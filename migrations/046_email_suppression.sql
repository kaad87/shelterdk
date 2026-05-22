-- =============================================================
-- 046 · Email suppression list
--
-- Stores addresses that hard-bounced or complained via Resend webhooks.
-- Sender checks this table before attempting new sends to avoid hitting
-- known-bad mailboxes (protects domain reputation + saves cost).
--
-- Also extends email_logs with delivery-status fields so the webhook can
-- track delivered/bounced/complained transitions without changing the
-- existing `status` value (which is set at send-time).
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS email_suppression (
  email      text PRIMARY KEY,
  reason     text NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now()
);

-- Locked-down: only service_role reads/writes.
ALTER TABLE email_suppression ENABLE ROW LEVEL SECURITY;

-- Extend email_logs with delivery webhook fields. Idempotent.
ALTER TABLE IF EXISTS email_logs
  ADD COLUMN IF NOT EXISTS delivery_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_metadata jsonb;

COMMIT;
