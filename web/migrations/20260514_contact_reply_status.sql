-- Adds 'replied' as a valid status for contact_messages.
-- Safe to run even if the table has no CHECK constraint — the EXCEPTION block catches that.
-- lock_timeout prevents blocking active writes for more than 2 seconds.

SET lock_timeout = '2s';

DO $$
BEGIN
  ALTER TABLE contact_messages
    DROP CONSTRAINT IF EXISTS contact_messages_status_check;
  ALTER TABLE contact_messages
    ADD CONSTRAINT contact_messages_status_check
      CHECK (status IN ('unread', 'read', 'archived', 'replied'));
EXCEPTION WHEN others THEN
  NULL;
END;
$$;
