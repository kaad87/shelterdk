# Booking Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-booking message thread between guests and shelter owners, inline on existing pages with email notifications.

**Architecture:** New `booking_messages` table stores messages; `read_at` tracks unread status. Four API routes handle GET/POST for guest (auth: `guest_token`) and owner (auth: `owner_token`). A fifth route returns unread counts for dashboard badges. UI is added inline to the existing guest booking page (`BookingPageClient.tsx`) and owner dashboard (`OwnerDashboard.tsx`) — no new pages.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres), Resend (email), Vitest (tests)

---

## File Map

| File | Change |
|------|--------|
| `web/supabase/migrations/20260427_booking_messages.sql` | CREATE — new table + index |
| `web/types/booking.ts` | MODIFY — add `BookingMessage` interface |
| `web/lib/messages-db.ts` | CREATE — all DB helpers + `validateMessageBody` |
| `web/lib/__tests__/booking-messages.test.ts` | CREATE — unit tests for `validateMessageBody` |
| `web/lib/booking-email.ts` | MODIFY — add 2 email functions |
| `web/app/api/booking/[guestToken]/messages/route.ts` | CREATE — GET + POST for guest |
| `web/app/api/owner/[token]/booking/[bookingId]/messages/route.ts` | CREATE — GET + POST for owner |
| `web/app/api/owner/[token]/unread-counts/route.ts` | CREATE — GET unread counts per shelter |
| `web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx` | MODIFY — add message thread section |
| `web/components/owner/OwnerDashboard.tsx` | MODIFY — add badge + inline thread panel |

---

## Task 1: Database migration

**Files:**
- Create: `web/supabase/migrations/20260427_booking_messages.sql`

- [ ] **Step 1: Write the migration file**

```sql
CREATE TABLE IF NOT EXISTS booking_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  sender     TEXT        NOT NULL CHECK (sender IN ('guest', 'owner')),
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ           -- NULL = ulæst af modtageren
);

CREATE INDEX IF NOT EXISTS booking_messages_booking_created
  ON booking_messages(booking_id, created_at);
```

- [ ] **Step 2: Note — apply manually in Supabase Dashboard**

Copy the SQL above and run it in the Supabase SQL editor. The migration file is committed to the repo as documentation but is not auto-applied.

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260427_booking_messages.sql
git commit -m "feat(messages): add booking_messages table migration"
```

---

## Task 2: TypeScript type + validation helper + tests (TDD)

**Files:**
- Modify: `web/types/booking.ts`
- Create: `web/lib/messages-db.ts` (validation helper only in this task)
- Create: `web/lib/__tests__/booking-messages.test.ts`

- [ ] **Step 1: Add `BookingMessage` to `web/types/booking.ts`**

Append at the end of the file:

```typescript
export interface BookingMessage {
  id: string;
  booking_id: string;
  sender: "guest" | "owner";
  body: string;
  created_at: string;
  read_at: string | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `web/lib/__tests__/booking-messages.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateMessageBody } from "@/lib/messages-db";

describe("validateMessageBody", () => {
  it("returns null for a normal message", () => {
    expect(validateMessageBody("Hej, må vi medbringe hund?")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validateMessageBody("")).not.toBeNull();
  });

  it("returns error for whitespace-only string", () => {
    expect(validateMessageBody("   \n  ")).not.toBeNull();
  });

  it("returns error for body over 2000 chars", () => {
    expect(validateMessageBody("x".repeat(2001))).not.toBeNull();
  });

  it("returns null for exactly 2000 chars", () => {
    expect(validateMessageBody("x".repeat(2000))).toBeNull();
  });

  it("returns error for non-string (null)", () => {
    expect(validateMessageBody(null)).not.toBeNull();
  });

  it("returns error for non-string (number)", () => {
    expect(validateMessageBody(42)).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd web && npx vitest run lib/__tests__/booking-messages.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/messages-db'`

- [ ] **Step 4: Create `web/lib/messages-db.ts` with only the validation helper**

```typescript
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookingMessage } from "@/types/booking";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns null if body is valid, or a Danish error message string.
 * Exported for testing and used by API routes.
 */
export function validateMessageBody(body: unknown): string | null {
  if (typeof body !== "string" || body.trim().length === 0)
    return "Beskeden må ikke være tom";
  if (body.length > 2000)
    return "Beskeden er for lang (maks. 2000 tegn)";
  return null;
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd web && npx vitest run lib/__tests__/booking-messages.test.ts
```

Expected: 7 tests passing

- [ ] **Step 6: Commit**

```bash
git add web/types/booking.ts web/lib/messages-db.ts web/lib/__tests__/booking-messages.test.ts
git commit -m "feat(messages): BookingMessage type + validateMessageBody (TDD)"
```

---

## Task 3: DB helpers

**Files:**
- Modify: `web/lib/messages-db.ts` (add DB functions below the existing validation helper)

- [ ] **Step 1: Append the four DB helpers to `web/lib/messages-db.ts`**

Add after the `validateMessageBody` function:

```typescript
// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Returns all messages for a booking, oldest first. */
export async function getMessagesForBooking(
  bookingId: string
): Promise<BookingMessage[]> {
  const { data } = await createAdminClient()
    .from("booking_messages")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  return (data ?? []) as BookingMessage[];
}

/** Inserts a new message row and returns it. */
export async function createMessage(
  bookingId: string,
  sender: "guest" | "owner",
  body: string
): Promise<BookingMessage> {
  const { data, error } = await createAdminClient()
    .from("booking_messages")
    .insert({ booking_id: bookingId, sender, body })
    .select()
    .single();
  if (error || !data) throw new Error("createMessage: " + error?.message);
  return data as BookingMessage;
}

/**
 * Marks all messages sent BY senderToMark as read (by the other party).
 * E.g. owner opens thread → markMessagesRead(id, "guest") marks the guest's
 * unread messages as read by the owner.
 */
export async function markMessagesRead(
  bookingId: string,
  senderToMark: "guest" | "owner"
): Promise<void> {
  await createAdminClient()
    .from("booking_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("sender", senderToMark)
    .is("read_at", null);
}

/**
 * Returns { bookingId → unreadCount } for all bookings of a shelter.
 * Counts only unread messages sent by guests (unread = not yet seen by owner).
 * Uses two queries to avoid a complex join.
 */
export async function getUnreadCountsForShelter(
  bookableShelterDbId: string
): Promise<Record<string, number>> {
  // Step 1: get active booking IDs for this shelter
  const { data: bookingRows } = await createAdminClient()
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .in("status", ["pending", "confirmed"]);

  if (!bookingRows?.length) return {};

  const ids = bookingRows.map((b) => b.id as string);

  // Step 2: count unread guest messages per booking
  const { data: msgRows } = await createAdminClient()
    .from("booking_messages")
    .select("booking_id")
    .in("booking_id", ids)
    .eq("sender", "guest")
    .is("read_at", null);

  const counts: Record<string, number> = {};
  for (const row of msgRows ?? []) {
    counts[row.booking_id] = (counts[row.booking_id] ?? 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
cd web && npx vitest run lib/__tests__/
```

Expected: all tests passing (including the 7 from Task 2)

- [ ] **Step 3: Commit**

```bash
git add web/lib/messages-db.ts
git commit -m "feat(messages): DB helpers (getMessages, createMessage, markRead, unreadCounts)"
```

---

## Task 4: Email functions

**Files:**
- Modify: `web/lib/booking-email.ts`

- [ ] **Step 1: Append two new email functions at the end of `web/lib/booking-email.ts`**

```typescript
/** Til ejeren: en gæst har sendt en ny besked */
export async function sendNewMessageToOwner(opts: {
  ownerEmail: string;
  ownerToken: string;
  guestName: string;
  shelterTitle: string;
  messageBody: string;
}): Promise<void> {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny besked fra ${esc(opts.guestName)} om ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny besked</h2>
        <p><strong>${esc(opts.guestName)}</strong> har sendt dig en besked om <strong>${esc(opts.shelterTitle)}</strong>:</p>
        <blockquote style="border-left:3px solid #c5a059;margin:16px 0;padding:10px 16px;background:#fef9ec;color:#1f2937;font-style:italic;">
          ${esc(opts.messageBody)}
        </blockquote>
        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Svar via dit dashboard</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ny besked til ejer): " + JSON.stringify(error));
}

/** Til gæsten: ejeren har sendt en ny besked */
export async function sendNewMessageToGuest(opts: {
  guestEmail: string;
  guestName: string;
  guestToken: string;
  shelterTitle: string;
  messageBody: string;
}): Promise<void> {
  const bookingUrl = `${SITE_URL}/min-booking/${opts.guestToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Ny besked fra ejeren af ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny besked</h2>
        <p>Hej ${esc(opts.guestName)}! Ejeren af <strong>${esc(opts.shelterTitle)}</strong> har sendt dig en besked:</p>
        <blockquote style="border-left:3px solid #c5a059;margin:16px 0;padding:10px 16px;background:#fef9ec;color:#1f2937;font-style:italic;">
          ${esc(opts.messageBody)}
        </blockquote>
        <div style="margin:24px 0;">
          <a href="${bookingUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Se besked og svar</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ny besked til gæst): " + JSON.stringify(error));
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "booking-email"
```

Expected: no errors related to `booking-email.ts`

- [ ] **Step 3: Commit**

```bash
git add web/lib/booking-email.ts
git commit -m "feat(messages): add sendNewMessageToOwner + sendNewMessageToGuest"
```

---

## Task 5: Guest messages API

**Files:**
- Create: `web/app/api/booking/[guestToken]/messages/route.ts`

Note: The directory `web/app/api/booking/[guestToken]/` already exists (contains `cancel/route.ts`). Just add the `messages/` subdirectory.

- [ ] **Step 1: Create `web/app/api/booking/[guestToken]/messages/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookingByGuestToken, getBookableShelterByPk } from "@/lib/booking-db";
import {
  getMessagesForBooking,
  createMessage,
  markMessagesRead,
  validateMessageBody,
} from "@/lib/messages-db";
import { sendNewMessageToOwner } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

/** Guest fetches their thread. Marks owner messages as read. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guestToken: string }> }
) {
  const { guestToken } = await params;
  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  const messages = await getMessagesForBooking(booking.id);
  await markMessagesRead(booking.id, "owner"); // owner's messages now read by guest
  return NextResponse.json({ messages });
}

/** Guest sends a message. Notifies owner by email (non-fatal). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guestToken: string }> }
) {
  const { guestToken } = await params;
  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const validationError = validateMessageBody(body.body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const message = await createMessage(booking.id, "guest", (body.body as string).trim());

  try {
    const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
    if (shelter) {
      await sendNewMessageToOwner({
        ownerEmail: shelter.owner_email,
        ownerToken: shelter.owner_token,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        messageBody: body.body as string,
      });
    }
  } catch (err) {
    console.error("guest message: owner email error:", err);
  }

  return NextResponse.json({ message }, { status: 201 });
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "messages"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/booking/[guestToken]/messages/route.ts"
git commit -m "feat(messages): guest messages API GET+POST /api/booking/[guestToken]/messages"
```

---

## Task 6: Owner messages API + unread counts

**Files:**
- Create: `web/app/api/owner/[token]/booking/[bookingId]/messages/route.ts`
- Create: `web/app/api/owner/[token]/unread-counts/route.ts`

Note: `/api/owner/[token]/messages/route.ts` already exists for auto-message templates. The new route is at `/api/owner/[token]/booking/[bookingId]/messages` — different path, no conflict.

- [ ] **Step 1: Create the owner messages route**

Create directory: `web/app/api/owner/[token]/booking/[bookingId]/messages/`

Create `route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
} from "@/lib/booking-db";
import {
  getMessagesForBooking,
  createMessage,
  markMessagesRead,
  validateMessageBody,
} from "@/lib/messages-db";
import { sendNewMessageToGuest } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

/** Owner fetches a booking's thread. Marks guest messages as read. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; bookingId: string }> }
) {
  const { token, bookingId } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  const messages = await getMessagesForBooking(bookingId);
  await markMessagesRead(bookingId, "guest"); // guest's messages now read by owner
  return NextResponse.json({ messages });
}

/** Owner sends a message. Notifies guest by email (non-fatal). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; bookingId: string }> }
) {
  const { token, bookingId } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const validationError = validateMessageBody(body.body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const message = await createMessage(bookingId, "owner", (body.body as string).trim());

  try {
    await sendNewMessageToGuest({
      guestEmail: booking.guest_email,
      guestName: booking.guest_name,
      guestToken: booking.guest_token,
      shelterTitle: shelter.title,
      messageBody: body.body as string,
    });
  } catch (err) {
    console.error("owner message: guest email error:", err);
  }

  return NextResponse.json({ message }, { status: 201 });
}
```

- [ ] **Step 2: Create `web/app/api/owner/[token]/unread-counts/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken } from "@/lib/booking-db";
import { getUnreadCountsForShelter } from "@/lib/messages-db";

export const dynamic = "force-dynamic";

/** Returns { [bookingId]: unreadCount } for all active bookings of this shelter. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const counts = await getUnreadCountsForShelter(shelter.id);
  return NextResponse.json(counts);
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "experiences/__tests__"
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add "web/app/api/owner/[token]/booking/[bookingId]/messages/route.ts" \
        "web/app/api/owner/[token]/unread-counts/route.ts"
git commit -m "feat(messages): owner messages API + unread counts endpoint"
```

---

## Task 7: Guest UI

**Files:**
- Modify: `web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx`

- [ ] **Step 1: Update the import line at the top of `BookingPageClient.tsx`**

The `"use client"` directive at line 1 stays untouched. Change only the `import` line:

From:
```typescript
import { useState } from "react";
```
To:
```typescript
import { useState, useEffect, useRef } from "react";
import type { BookingMessage } from "@/types/booking";
```

- [ ] **Step 2: Add message state variables after the existing `useState` declarations (after `showConfirm`)**

```typescript
// Message thread state
const [messages, setMessages] = useState<BookingMessage[]>([]);
const [msgLoading, setMsgLoading] = useState(true);
const [newMsg, setNewMsg] = useState("");
const [sending, setSending] = useState(false);
const [msgError, setMsgError] = useState<string | null>(null);
const messagesEndRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add useEffect hooks after the existing state declarations (before the `handleCancel` function)**

```typescript
// Load messages on mount
useEffect(() => {
  fetch(`/api/booking/${guestToken}/messages`)
    .then((r) => r.json())
    .then((data) => setMessages(data.messages ?? []))
    .catch(() => {})
    .finally(() => setMsgLoading(false));
}, [guestToken]);

// Scroll to latest message when thread updates
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

- [ ] **Step 4: Add `handleSendMessage` function after the `handleCancel` function**

```typescript
async function handleSendMessage() {
  if (!newMsg.trim() || sending) return;
  setSending(true);
  setMsgError(null);
  try {
    const res = await fetch(`/api/booking/${guestToken}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Noget gik galt");
    setMessages((prev) => [...prev, data.message as BookingMessage]);
    setNewMsg("");
  } catch (err) {
    setMsgError(err instanceof Error ? err.message : "Noget gik galt");
  } finally {
    setSending(false);
  }
}
```

- [ ] **Step 5: Add the message thread section to the JSX**

Add before the final closing `</div>` of the component's return (after the cancelled-state block):

```tsx
{/* ── Beskeder ── */}
<div className="mt-8">
  <h2 className="text-sm font-bold text-gray-700 mb-3">
    Beskeder
    {messages.length > 0 && (
      <span className="ml-2 font-normal text-gray-400">· {messages.length}</span>
    )}
  </h2>

  {msgLoading ? (
    <p className="text-sm text-gray-400">Henter beskeder…</p>
  ) : (
    <div className="space-y-3 mb-4">
      {messages.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          Ingen beskeder endnu. Skriv til ejeren herunder.
        </p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex flex-col ${m.sender === "guest" ? "items-end" : "items-start"}`}
        >
          <div className="text-xs text-gray-400 mb-1">
            {m.sender === "guest" ? "Dig" : "Ejeren"}
            {" · "}
            {new Date(m.created_at).toLocaleDateString("da-DK", {
              day: "numeric",
              month: "short",
            })}
            {m.sender === "owner" && !m.read_at && (
              <span className="ml-1 text-[#c5a059] font-semibold">· Ny</span>
            )}
          </div>
          <div
            className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.sender === "guest"
                ? "bg-[#c5a059] text-white rounded-tr-none"
                : "bg-gray-100 text-gray-900 rounded-tl-none"
            }`}
          >
            {m.body}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )}

  {status !== "cancelled" && status !== "rejected" && (
    <div className="flex gap-2 items-end">
      <textarea
        value={newMsg}
        onChange={(e) => setNewMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        }}
        placeholder="Skriv en besked til ejeren…"
        rows={2}
        maxLength={2000}
        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#c5a059]/30 focus:border-[#c5a059]/50"
      />
      <button
        onClick={handleSendMessage}
        disabled={!newMsg.trim() || sending}
        className="bg-[#c5a059] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#b8935a] disabled:opacity-40 transition-colors"
      >
        {sending ? "Sender…" : "Send"}
      </button>
    </div>
  )}
  {msgError && <p className="text-sm text-red-600 mt-2">{msgError}</p>}
</div>
```

- [ ] **Step 6: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "BookingPageClient"
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add "web/app/(site)/min-booking/[guestToken]/BookingPageClient.tsx"
git commit -m "feat(messages): message thread on guest booking page"
```

---

## Task 8: Owner Dashboard UI

**Files:**
- Modify: `web/components/owner/OwnerDashboard.tsx`

This task adds unread-count badges and an inline thread panel to the existing dashboard. Make each edit carefully — the file is large (~1300 lines).

- [ ] **Step 1: Add `BookingMessage` to the import at line 4**

Change:
```typescript
import type { ShelterBooking, BookableShelter } from "@/types/booking";
```
To:
```typescript
import type { ShelterBooking, BookableShelter, BookingMessage } from "@/types/booking";
```

- [ ] **Step 2: Add message-related state variables**

After the `cutoffMsg` state block (the last state block added in the cancellation feature), add:

```typescript
// Message thread state
const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
const [openThreadId, setOpenThreadId] = useState<string | null>(null);
const [threadMessages, setThreadMessages] = useState<Record<string, BookingMessage[]>>({});
const [threadMsgBody, setThreadMsgBody] = useState<Record<string, string>>({});
const [sendingMsgId, setSendingMsgId] = useState<string | null>(null);
const [msgSendError, setMsgSendError] = useState<string | null>(null);
```

- [ ] **Step 3: Add `fetchUnreadCounts` + `handleFetchThread` + `handleSendMsg` functions**

Add after the `handleCutoffSave` function:

```typescript
const fetchUnreadCounts = useCallback(async () => {
  try {
    const res = await fetch(`/api/owner/${ownerToken}/unread-counts`);
    if (res.ok) setUnreadCounts(await res.json());
  } catch {
    // silently fail
  }
}, [ownerToken]);

useEffect(() => { fetchUnreadCounts(); }, [fetchUnreadCounts]);

const handleFetchThread = async (bookingId: string) => {
  if (openThreadId === bookingId) {
    // Already open — close it
    setOpenThreadId(null);
    return;
  }
  setOpenThreadId(bookingId);
  setMsgSendError(null);
  try {
    const res = await fetch(
      `/api/owner/${ownerToken}/booking/${bookingId}/messages`
    );
    if (res.ok) {
      const data = await res.json();
      setThreadMessages((prev) => ({ ...prev, [bookingId]: data.messages }));
      // Clear the unread badge for this booking
      setUnreadCounts((prev) => ({ ...prev, [bookingId]: 0 }));
    }
  } catch {
    // silently fail — thread panel shows empty state
  }
};

const handleSendMsg = async (bookingId: string) => {
  const body = threadMsgBody[bookingId]?.trim();
  if (!body || sendingMsgId === bookingId) return;
  setSendingMsgId(bookingId);
  setMsgSendError(null);
  try {
    const res = await fetch(
      `/api/owner/${ownerToken}/booking/${bookingId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Fejl");
    setThreadMessages((prev) => ({
      ...prev,
      [bookingId]: [...(prev[bookingId] ?? []), data.message as BookingMessage],
    }));
    setThreadMsgBody((prev) => ({ ...prev, [bookingId]: "" }));
  } catch (err) {
    setMsgSendError(err instanceof Error ? err.message : "Noget gik galt");
  } finally {
    setSendingMsgId(null);
  }
};
```

- [ ] **Step 4: Add badge + thread panel to the pending bookings section**

In the pending bookings `map` block, add the badge button and thread panel after the existing action buttons. Find the section ending with `</div>{/* end confirm/reject buttons */}` and add:

```tsx
{/* Message badge / button */}
<div className="mt-1 flex gap-2">
  <button
    onClick={() => handleFetchThread(b.id)}
    className="text-xs text-[#c5a059] hover:text-[#b8935a] font-medium transition-colors"
  >
    {(unreadCounts[b.id] ?? 0) > 0
      ? `✉ ${unreadCounts[b.id]} ny`
      : "✉ Skriv"}
  </button>
</div>

{/* Inline thread panel */}
{openThreadId === b.id && (
  <MessageThreadPanel
    messages={threadMessages[b.id] ?? []}
    body={threadMsgBody[b.id] ?? ""}
    onBodyChange={(v) => setThreadMsgBody((prev) => ({ ...prev, [b.id]: v }))}
    onSend={() => handleSendMsg(b.id)}
    sending={sendingMsgId === b.id}
    error={msgSendError}
    guestName={b.guest_name}
  />
)}
```

- [ ] **Step 5: Add badge + thread panel to the confirmed (upcoming) bookings section**

In the upcoming bookings `map` block, after the existing action buttons div (after the `Annullér` button and confirm dialog), add:

```tsx
{/* Message badge / button */}
{b.status === "confirmed" && (
  <div className="mt-1 flex gap-2">
    <button
      onClick={() => handleFetchThread(b.id)}
      className="text-xs text-[#c5a059] hover:text-[#b8935a] font-medium transition-colors"
    >
      {(unreadCounts[b.id] ?? 0) > 0
        ? `✉ ${unreadCounts[b.id]} ny`
        : "✉ Skriv"}
    </button>
  </div>
)}

{/* Inline thread panel */}
{openThreadId === b.id && (
  <MessageThreadPanel
    messages={threadMessages[b.id] ?? []}
    body={threadMsgBody[b.id] ?? ""}
    onBodyChange={(v) => setThreadMsgBody((prev) => ({ ...prev, [b.id]: v }))}
    onSend={() => handleSendMsg(b.id)}
    sending={sendingMsgId === b.id}
    error={msgSendError}
    guestName={b.guest_name}
  />
)}
```

- [ ] **Step 6: Add the `MessageThreadPanel` component**

Add this component just before the `export function OwnerDashboard` line at the bottom of the file (or near the top after the other helper components):

```tsx
function MessageThreadPanel({
  messages,
  body,
  onBodyChange,
  onSend,
  sending,
  error,
  guestName,
}: {
  messages: BookingMessage[];
  body: string;
  onBodyChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
  guestName: string;
}) {
  return (
    <div className="mt-2 border-t border-gray-100 pt-3">
      <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Ingen beskeder endnu. Skriv til {guestName} herunder.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "owner" ? "items-end" : "items-start"}`}
          >
            <div className="text-[10px] text-gray-400 mb-1">
              {m.sender === "owner" ? "Dig" : guestName}
              {" · "}
              {new Date(m.created_at).toLocaleDateString("da-DK", {
                day: "numeric",
                month: "short",
              })}
            </div>
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.sender === "owner"
                  ? "bg-[#c5a059] text-white rounded-tr-none"
                  : "bg-gray-100 text-gray-900 rounded-tl-none"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={`Svar ${guestName}…`}
          rows={2}
          maxLength={2000}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#c5a059]/30 focus:border-[#c5a059]/40"
        />
        <button
          onClick={onSend}
          disabled={!body.trim() || sending}
          className="bg-[#c5a059] text-white text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#b8935a] disabled:opacity-40 transition-colors"
        >
          {sending ? "Sender…" : "Send"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Run TypeScript check + all tests**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "experiences/__tests__"
cd web && npx vitest run
```

Expected: no TS errors, all tests passing

- [ ] **Step 8: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat(messages): owner dashboard — unread badges + inline message thread"
```

---

## Task 9: Final integration check + apply migration

- [ ] **Step 1: Apply migration in Supabase Dashboard**

Copy-paste the SQL from `web/supabase/migrations/20260427_booking_messages.sql` into the Supabase SQL editor and run it. Verify the `booking_messages` table exists with the correct schema.

- [ ] **Step 2: Run full test suite**

```bash
cd web && npx vitest run
```

Expected: all tests passing

- [ ] **Step 3: TypeScript full check**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "experiences/__tests__"
```

Expected: no new errors

- [ ] **Step 4: Manual smoke test**

1. Open a booking on `/min-booking/[guestToken]` — message section loads empty
2. Type a message and send — bubble appears on the right
3. Open owner dashboard — ✉-badge appears on the booking
4. Click badge — thread panel opens with the guest's message
5. Type a reply and send — bubble appears on the right (owner's side)
6. Reload guest page — owner's reply appears on the left with "Ny" marker
7. Owner dashboard badge disappears after thread is opened

- [ ] **Step 5: Push to production**

```bash
git push
```
