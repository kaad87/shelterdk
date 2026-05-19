# Admin Contact Reply — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin view and reply to contact form submissions from `/admin/kontakt`, sending replies via Resend with the signed "Christian / ShelterDK" signature.

**Architecture:** Five self-contained tasks: DB migration → email function + tests → API POST handler → admin UI page → admin index link. Each task compiles and commits independently. No new DB tables — replies are tracked in `email_logs` and `contact_messages.status`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase Postgres (admin client), Resend (via existing `sendLoggedEmail`), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/migrations/20260514_contact_reply_status.sql` | Create | Adds `"replied"` to CHECK constraint on `contact_messages.status` |
| `web/lib/email.ts` | Modify | Add `sendAdminReplyEmail()` function |
| `web/lib/__tests__/admin-reply-email.test.ts` | Create | Unit tests for reply email HTML/text output |
| `web/app/api/admin/contact/route.ts` | Modify | Add POST handler; add `"replied"` to PATCH allowlist |
| `web/app/(site)/admin/kontakt/page.tsx` | Create | Admin UI: message list + inline reply + status filter |
| `web/app/(site)/admin/page.tsx` | Modify | Add "💬 Kontaktbeskeder" link |

---

## Task 1: DB Migration

**Files:**
- Create: `web/migrations/20260514_contact_reply_status.sql`

- [ ] **Step 1: Create migration file**

```sql
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
```

- [ ] **Step 2: Run migration in Supabase**

In the Supabase SQL editor (or via CLI), run the file contents. Verify no error is returned. If you get "lock timeout", wait 10 seconds and retry — it is safe to run multiple times.

- [ ] **Step 3: Commit**

```bash
git add web/migrations/20260514_contact_reply_status.sql
git commit -m "feat: add replied status to contact_messages constraint"
```

---

## Task 2: `sendAdminReplyEmail()` + Tests

**Files:**
- Modify: `web/lib/email.ts` (append after existing functions)
- Create: `web/lib/__tests__/admin-reply-email.test.ts`

### Background on existing helpers (read before coding)

`lib/email.ts` already exports:
- `FROM_EMAIL = "ShelterDK <hej@shelterdk.dk>"`
- `escapeHtml(str)` — escapes `& < > " '`
- `renderEmail({ title, bodyHtml, preheader? })` — returns full HTML email string
- `renderEmailText({ title, lines, url? })` — returns plain text email string
- `sendLoggedEmail({ to, subject, html, text, replyTo?, context })` — sends via Resend + logs to `email_logs`

### Step 1: Write the failing tests first

- [ ] Create `web/lib/__tests__/admin-reply-email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAdminReplyEmailHtml, buildAdminReplyEmailText } from "../email";

describe("buildAdminReplyEmailHtml()", () => {
  const opts = {
    toName: "Lars",
    replyText: "Tak for din henvendelse, vi kigger på det.",
    originalMessage: "Hej, jeg kan ikke booke shelter X.",
  };

  it("includes the reply text", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Tak for din henvendelse");
  });

  it("includes the original message quoted", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Hej, jeg kan ikke booke shelter X.");
  });

  it("includes the signature", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Christian");
    expect(html).toContain("ShelterDK");
  });

  it("escapes HTML in replyText", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, replyText: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in originalMessage", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, originalMessage: '<img src=x onerror="xss">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes HTML in toName", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, toName: "<b>Hacker</b>" });
    expect(html).not.toContain("<b>Hacker</b>");
  });
});

describe("buildAdminReplyEmailText()", () => {
  const opts = {
    replyText: "Hej, vi har set på sagen.",
    originalMessage: "Problemet er at X ikke virker.",
  };

  it("includes the reply text", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("vi har set på sagen");
  });

  it("includes the original message", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("Problemet er at X ikke virker");
  });

  it("includes signature name", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("Christian");
  });

  it("ends with shelterdk.dk", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text.trim().endsWith("shelterdk.dk")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd web && npx vitest run lib/__tests__/admin-reply-email.test.ts
```

Expected: `Cannot find module '../email'` errors for `buildAdminReplyEmailHtml` / `buildAdminReplyEmailText` — this is correct.

- [ ] **Step 3: Add import and exports to `web/lib/email.ts`**

> Note: `sendAdminReplyEmail` uses `sendLoggedEmail` which is already in the same file — no new import needed. The function is appended after the last existing function.

Append after the last function in `lib/email.ts`:

```typescript
// ─── Admin reply email ─────────────────────────────────────────────────────────

export interface AdminReplyEmailOpts {
  toName: string;
  replyText: string;
  originalMessage: string;
}

export function buildAdminReplyEmailHtml(opts: AdminReplyEmailOpts): string {
  const { toName, replyText, originalMessage } = opts;
  return renderEmail({
    title: "Svar fra ShelterDK",
    preheader: replyText.slice(0, 120),
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Hej <strong>${escapeHtml(toName)}</strong>,
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        ${escapeHtml(replyText).replace(/\n/g, "<br>")}
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
      <hr style="border:none;border-top:1px solid #ede9e1;margin:16px 0;">
      <p style="font-size:11px;color:#aaa;margin:0 0 6px;">Din oprindelige besked:</p>
      <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0;padding:10px 14px;border-radius:0 6px 6px 0;">
        <p style="font-size:12px;color:#666;line-height:1.5;margin:0;">
          ${escapeHtml(originalMessage).replace(/\n/g, "<br>")}
        </p>
      </blockquote>
    `,
  });
}

export function buildAdminReplyEmailText(opts: { replyText: string; originalMessage: string }): string {
  return renderEmailText({
    title: "Svar fra ShelterDK",
    lines: [
      opts.replyText,
      "",
      "Med venlig hilsen,",
      "Christian",
      "ShelterDK · shelterdk.dk",
      "",
      "---",
      "Din oprindelige besked:",
      opts.originalMessage,
    ],
  });
}

export async function sendAdminReplyEmail(opts: {
  toEmail: string;
  toName: string;
  replyText: string;
  originalMessage: string;
  contactMessageId: string;
}) {
  const html = buildAdminReplyEmailHtml(opts);
  const text = buildAdminReplyEmailText(opts);
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Re: Din henvendelse til ShelterDK",
    html,
    text,
    context: {
      category: "contact",
      emailType: "admin_reply",
      metadata: {
        contactMessageId: opts.contactMessageId,
        toName: opts.toName,
      },
    },
  });
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd web && npx vitest run lib/__tests__/admin-reply-email.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd web && npx vitest run
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add web/lib/email.ts web/lib/__tests__/admin-reply-email.test.ts
git commit -m "feat: add sendAdminReplyEmail with buildAdminReplyEmailHtml/Text helpers"
```

---

## Task 3: API — POST handler + PATCH fix

**Files:**
- Modify: `web/app/api/admin/contact/route.ts`

The file currently has GET, PATCH, DELETE. We need to:
1. Add `"replied"` to the PATCH status allowlist
2. Add a new `POST` handler

- [ ] **Step 1: Add import at the top of `route.ts`**

Add to the existing import block at the top of `app/api/admin/contact/route.ts`:

```typescript
import { sendAdminReplyEmail } from "@/lib/email";
```

- [ ] **Step 2: Update PATCH allowlist**

In `route.ts`, find this line:

```typescript
if (!["unread", "read", "archived"].includes(body.status)) {
```

Change to:

```typescript
if (!["unread", "read", "archived", "replied"].includes(body.status)) {
```

- [ ] **Step 3: Add POST handler**

Add after the existing DELETE export in `route.ts`:

```typescript
export async function POST(request: Request) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; replyText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  const replyText = body.replyText?.trim();

  if (!id || !replyText) {
    return Response.json({ error: "Mangler id eller replyText" }, { status: 400 });
  }
  if (replyText.length > 5000) {
    return Response.json({ error: "Svaret er for langt (max 5000 tegn)" }, { status: 400 });
  }

  // Fetch original message
  const supabase = createAdminClient();
  const { data: msg, error: fetchError } = await supabase
    .from("contact_messages")
    .select("id, name, email, message")
    .eq("id", id)
    .single();

  if (fetchError || !msg) {
    return Response.json({ error: "Besked ikke fundet" }, { status: 404 });
  }

  // Send email first — if it fails, do NOT update DB status
  try {
    await sendAdminReplyEmail({
      toEmail: msg.email as string,
      toName: msg.name as string,
      replyText,
      originalMessage: msg.message as string,
      contactMessageId: id,
    });
  } catch (err) {
    console.error("admin reply send failed:", err);
    return Response.json(
      { error: "Kunne ikke sende svar — prøv igen." },
      { status: 502 }
    );
  }

  // Email sent — now update status
  const { error: updateError } = await supabase
    .from("contact_messages")
    .update({ status: "replied" })
    .eq("id", id);

  if (updateError) {
    console.error("admin reply status update failed after send:", updateError);
    // Email was sent successfully — return 500 so UI knows to refresh
    return Response.json(
      { error: "Svar sendt, men status kunne ikke opdateres — opdater siden." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "admin/contact"
```

Expected: no errors on that file.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/contact/route.ts
git commit -m "feat: add POST reply handler and replied status to admin contact API"
```

---

## Task 4: Admin contact page

**Files:**
- Create: `web/app/(site)/admin/kontakt/page.tsx`

Follow the exact same pattern as `app/(site)/admin/redirects/page.tsx`: `"use client"`, secret from sessionStorage, fetch on mount, inline actions, Danish UI strings.

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "shelterdk-admin-secret";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: "unread" | "read" | "replied" | "archived";
  created_at: string;
};

type Tab = "alle" | "unread" | "replied" | "archived";

const STATUS_LABELS: Record<ContactMessage["status"], string> = {
  unread: "Ulæst",
  read: "Læst",
  replied: "Besvaret",
  archived: "Arkiveret",
};

const STATUS_COLORS: Record<ContactMessage["status"], string> = {
  unread: "bg-amber-100 text-amber-800",
  read: "bg-gray-100 text-gray-600",
  replied: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "Generelt",
  fejl: "Fejl",
  forslag: "Forslag",
  andet: "Andet",
};

export default function AdminKontaktPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : ""
  );
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("alle");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!secret) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/contact", {
          headers: { "x-admin-secret": secret },
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401) throw new Error("401");
          throw new Error(data.error ?? "FETCH_FAILED");
        }
        if (!cancelled) {
          setMessages((data.messages ?? []) as ContactMessage[]);
          setErrorMsg(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message === "401") setAuthError(true);
          else setErrorMsg(err instanceof Error ? err.message : "Kunne ikke hente beskeder.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [secret]);

  async function refresh() {
    const r = await fetch("/api/admin/contact", { headers: { "x-admin-secret": secret } });
    const data = await r.json().catch(() => ({}));
    if (r.ok) setMessages((data.messages ?? []) as ContactMessage[]);
  }

  async function handleArchive(id: string) {
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id, status: "archived" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke arkivere");
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReply(id: string) {
    const replyText = replyTexts[id]?.trim();
    if (!replyText) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id, replyText }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke sende svar");
      setReplyOpen(null);
      setReplyTexts((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = messages.filter((m) => {
    if (activeTab === "alle") return true;
    if (activeTab === "unread") return m.status === "unread";
    if (activeTab === "replied") return m.status === "replied";
    if (activeTab === "archived") return m.status === "archived";
    return true;
  });

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-primary/60 text-sm">
            Log ind via{" "}
            <Link href="/admin" className="text-accent underline">
              admin-forsiden
            </Link>{" "}
            først.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <nav className="text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Kontaktbeskeder</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-primary">Kontaktbeskeder</h1>
        <p className="text-sm text-primary/60 mt-1">
          Henvendelser fra kontaktformularen.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-primary/10">
        {(["alle", "unread", "replied", "archived"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-primary/60 hover:text-primary"
            }`}
          >
            {tab === "alle" && `Alle (${messages.length})`}
            {tab === "unread" && `Ulæste${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            {tab === "replied" && "Besvaret"}
            {tab === "archived" && "Arkiveret"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Indlæser beskeder…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Ingen beskeder.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((msg) => (
            <article
              key={msg.id}
              className="rounded-xl border border-primary/10 bg-white p-5 space-y-3"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary text-sm">{msg.name}</p>
                  <p className="text-xs text-primary/50">{msg.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-primary/40">
                    {new Date(msg.created_at).toLocaleString("da-DK")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[msg.status]}`}>
                    {STATUS_LABELS[msg.status]}
                  </span>
                  <span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs text-primary/60">
                    {CATEGORY_LABELS[msg.category] ?? msg.category}
                  </span>
                </div>
              </div>

              {/* Message body */}
              <p className="text-sm text-primary/80 leading-relaxed whitespace-pre-wrap">
                {msg.message}
              </p>

              {/* Inline reply form */}
              {replyOpen === msg.id && (
                <div className="space-y-2 pt-1">
                  <textarea
                    rows={5}
                    value={replyTexts[msg.id] ?? ""}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                    }
                    placeholder="Skriv dit svar…"
                    className="block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReply(msg.id)}
                      disabled={busyId === msg.id || !replyTexts[msg.id]?.trim()}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === msg.id ? "Sender…" : "Send svar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyOpen(null)}
                      className="rounded-lg border border-primary/15 px-4 py-2 text-sm text-primary/60 hover:text-primary"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {replyOpen !== msg.id && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReplyOpen(msg.id)}
                    disabled={busyId === msg.id}
                    className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Besvar
                  </button>
                  {msg.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(msg.id)}
                      disabled={busyId === msg.id}
                      className="rounded-lg border border-primary/15 px-4 py-2 text-sm text-primary/60 hover:text-primary disabled:opacity-50"
                    >
                      Arkivér
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "admin/kontakt"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/(site)/admin/kontakt/page.tsx
git commit -m "feat: add admin contact messages page with inline reply"
```

---

## Task 5: Admin index link

**Files:**
- Modify: `web/app/(site)/admin/page.tsx`

- [ ] **Step 1: Add the link**

In `app/(site)/admin/page.tsx`, find the last `<Link>` inside the quick-links `<div className="mb-8 flex flex-wrap gap-3">` block. It currently ends with the redirects link:

```tsx
<Link
  href="/admin/redirects"
  className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
>
  ↪️ Redirects
</Link>
```

Add a new link after it:

```tsx
<Link
  href="/admin/kontakt"
  className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
>
  💬 Kontaktbeskeder
</Link>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "admin/page"
```

Expected: no errors.

- [ ] **Step 3: Run full test suite one last time**

```bash
cd web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/app/(site)/admin/page.tsx
git commit -m "feat: add Kontaktbeskeder link to admin index"
```

---

## Verification Checklist

After all tasks are committed, verify manually:

1. `/admin` shows "💬 Kontaktbeskeder" link
2. `/admin/kontakt` loads, shows existing messages
3. Filter tabs: "Ulæste" shows only unread, "Besvaret" shows only replied, "Arkiveret" shows only archived
4. "Arkivér" on a message → status badge changes to "Arkiveret"
5. "Besvar" → inline textarea expands
6. Submit a reply → email arrives at the sender's address (check Resend dashboard)
7. After reply: badge changes to "Besvaret", reply field closes
8. `/admin/email-log` shows a new entry with category `contact`, type `admin_reply`
9. No `/api/admin/contact` error if replying to same message twice (idempotent send — status already "replied" but update is still a no-op)
