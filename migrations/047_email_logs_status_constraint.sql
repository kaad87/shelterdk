-- =============================================================
-- 047 · Extend email_logs.status CHECK constraint
--
-- The 046 migration added webhook delivery tracking columns
-- (delivery_event_at, delivery_metadata) but the existing
-- CHECK constraint on status still only allows ('sent', 'failed').
--
-- The webhook handler tries to set status to delivered/bounced/
-- complained — those updates were rejected silently with 23514
-- "check constraint violation" and the rows kept status = 'sent'
-- with delivery_event_at NULL.
--
-- Also adds 'suppressed' (used when sender skips a recipient on
-- the suppression list).
-- =============================================================

BEGIN;

-- Drop old constraint (name may differ — try the common Supabase auto-generated name).
ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_status_check;

-- Add the new constraint covering all statuses the application writes.
ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('sent', 'failed', 'suppressed', 'delivered', 'bounced', 'complained'));

COMMIT;
