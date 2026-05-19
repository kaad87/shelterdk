# Admin Contact Reply — Design Spec

## Context

Users submit contact messages via the public contact form (`/kontakt`). Messages are stored in the `contact_messages` table (id, name, email, category, message, status, created_at). The admin can currently list, update status, and delete messages via `/api/admin/contact` — but there is no admin UI and no way to reply from the panel.

The goal is a minimal, practical reply feature: view all messages in the admin panel, write a reply inline, send it via email, and track that it was answered.

---

## Architecture

### New admin page: `/admin/kontakt`

A client-side "use client" page following the same pattern as `/admin/redirects` (secret from sessionStorage, fetch on mount, inline actions).

**Layout:**
- Breadcrumb nav (Hjem / Admin / Kontaktbeskeder)
- Status filter tabs: **Alle | Ulæste | Besvaret | Arkiveret** — client-side filter, no extra API calls. Messages with status `"read"` have no dedicated tab and appear only under "Alle" — this is intentional (read-without-reply is a transient state, not worth a permanent tab).
- Message cards sorted newest first
- Each card shows: name, email, category badge, date, full message text, status badge
- Two actions per card: **Besvar** (expands inline reply field) and **Arkivér**
- Clicking "Besvar" opens a `<textarea>` + "Send svar"-knap inline below the message
- On send: POST to `/api/admin/contact` → success → status badge updates to "Besvaret", reply field closes

**Status colours:**
- `unread` → amber badge ("Ulæst")
- `read` → grey badge ("Læst")
- `replied` → green badge ("Besvaret")
- `archived` → muted badge ("Arkiveret")

**Admin index** (`/admin/page.tsx`): Add link `💬 Kontaktbeskeder` to the quick-links grid.

---

### API changes: `POST /api/admin/contact`

New handler on the existing route file.

**Request body:** `{ id: string, replyText: string }`

**Server steps:**
1. Auth check (`x-admin-secret`) → 401 if missing/wrong
2. Validate `id` and `replyText` (non-empty, max 5000 chars) → 400 if invalid
3. Fetch original message from DB → 404 if not found
4. Call `sendAdminReplyEmail()` → if Resend returns an error, return 502 `{ error: "Kunne ikke sende svar — prøv igen." }`. Do NOT update DB status.
5. Only after confirmed send: PATCH `contact_messages` status to `"replied"`. If this DB step fails, log the inconsistency (`console.error`) and return 500 — the email was sent, so tell the admin to manually refresh.
6. Return `{ ok: true }`

**Existing PATCH handler:** Add `"replied"` to the list of accepted statuses so the UI can also toggle status manually if needed.

---

### Email function: `sendAdminReplyEmail()` in `lib/email.ts`

```ts
sendAdminReplyEmail(opts: {
  toEmail: string;
  toName: string;
  originalMessage: string;
  replyText: string;
}): Promise<void>
```

- **From:** `ShelterDK <hej@shelterdk.dk>` (existing `FROM_EMAIL`)
- **To:** user's email
- **Subject:** `Re: Din henvendelse til ShelterDK`
- **Template:** Uses existing `renderEmail` + `renderEmailText`
- **Body:** Shows reply text, then quotes original message in a `<blockquote>`. Both `replyText` and `originalMessage` are treated as plain text and passed through `escapeHtml()` before insertion into HTML — never rendered raw.
- **Signature:**
  ```
  Med venlig hilsen
  Christian
  ShelterDK · shelterdk.dk
  ```
- **Logged via:** `sendLoggedEmail` with `category: "contact"`, `emailType: "admin_reply"`

---

### Migration: `20260514_contact_reply_status.sql`

Adds `"replied"` to the status CHECK constraint on `contact_messages` (if one exists). Written defensively so it is a no-op if the constraint does not exist:

```sql
SET lock_timeout = '2s';

DO $$
BEGIN
  ALTER TABLE contact_messages
    DROP CONSTRAINT IF EXISTS contact_messages_status_check;
  ALTER TABLE contact_messages
    ADD CONSTRAINT contact_messages_status_check
      CHECK (status IN ('unread', 'read', 'archived', 'replied'));
EXCEPTION WHEN others THEN
  NULL; -- table may not exist yet, or lock timeout hit — safe to retry
END;
$$;
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/(site)/admin/kontakt/page.tsx` | **New** — full admin contact UI |
| `app/api/admin/contact/route.ts` | Add POST handler; add "replied" to PATCH allowlist |
| `app/(site)/admin/page.tsx` | Add "💬 Kontaktbeskeder" link |
| `lib/email.ts` | Add `sendAdminReplyEmail()` |
| `migrations/20260514_contact_reply_status.sql` | **New** — defensive CHECK constraint update |

## What Is NOT Changed

- `contact_messages` table schema (no new columns)
- No `contact_replies` table (replies live in `email_logs`)
- Public contact form — unchanged
- Auth mechanism — same `x-admin-secret` pattern as all other admin routes
- Email template styling — uses existing `renderEmail` helpers

## Verification

1. `/admin/kontakt` loads and shows existing messages
2. Filter tabs correctly show only messages of that status
3. "Arkivér" updates status and hides from "Ulæste" tab
4. "Besvar" expands inline textarea
5. Submitting reply sends email to user's address (check Resend dashboard or email_logs)
6. After reply: status badge on card changes to "Besvaret"
7. Message appears in `/admin/email-log` as category "contact", type "admin_reply"
8. Admin index shows "💬 Kontaktbeskeder" link
