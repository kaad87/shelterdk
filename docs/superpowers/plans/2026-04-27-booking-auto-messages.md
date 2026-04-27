# Booking Auto-Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let shelter owners write personalised confirmation and day-before reminder emails that are sent automatically to guests — confirmation on booking confirmed, reminder daily at 08:00 UTC.

**Architecture:** New `booking_message_templates` table stores per-shelter templates with 6 placeholders. A GET/PATCH API route handles the owner dashboard editor. The existing action route is extended to send confirmation emails. A new Netlify Scheduled Function runs daily and sends reminders for next-day check-ins.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase (Postgres + service role) · Resend (email) · Netlify Scheduled Functions · Vitest

---

## File Map

| File | Change |
|------|--------|
| `web/supabase/migrations/20260427_booking_message_templates.sql` | **Create** — DB migration: new table + new column |
| `web/lib/__tests__/booking-auto-messages.test.ts` | **Create** — Unit tests for placeholder replacement |
| `web/lib/booking-email.ts` | **Modify** — Add `sendBookingAutoMessage()` |
| `web/app/api/owner/[token]/messages/route.ts` | **Create** — GET + PATCH template API |
| `web/app/api/owner/[token]/action/route.ts` | **Modify** — Send auto-message on confirm |
| `web/netlify/functions/send-reminders.mts` | **Create** — Daily cron for reminder emails |
| `web/components/owner/OwnerDashboard.tsx` | **Modify** — Add messages editor section |

---

## Task 1: DB Migration

**Files:**
- Create: `web/supabase/migrations/20260427_booking_message_templates.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the migration.

Verify:
- `booking_message_templates` table exists with correct columns
- `shelter_bookings` has `reminder_sent_at` column (nullable timestamptz)

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260427_booking_message_templates.sql
git commit -m "feat: migration 040 — booking_message_templates table + reminder_sent_at column"
```

---

## Task 2: Placeholder Replacement Helper + Tests

The core placeholder replacement logic is a pure function — extract it to `lib/booking-email.ts` and test it with Vitest before using it in email sending and the cron job.

**Files:**
- Create: `web/lib/__tests__/booking-auto-messages.test.ts`
- Modify: `web/lib/booking-email.ts` (add `applyMessagePlaceholders` export)

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/booking-auto-messages.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyMessagePlaceholders } from "@/lib/booking-email";

describe("applyMessagePlaceholders", () => {
  const base = {
    guestName: "Lars Andersen",
    shelterTitle: "Ørnebjerg Shelter",
    checkIn: "2026-05-22",
    checkOut: "2026-05-24",
    guestCount: 3,
  };

  it("replaces {gæst_navn}", () => {
    expect(applyMessagePlaceholders("Hej {gæst_navn}!", base)).toBe("Hej Lars Andersen!");
  });

  it("replaces {shelter_navn}", () => {
    expect(applyMessagePlaceholders("{shelter_navn}", base)).toBe("Ørnebjerg Shelter");
  });

  it("replaces {antal_nætter} correctly", () => {
    // 22 May → 24 May = 2 nights
    expect(applyMessagePlaceholders("{antal_nætter}", base)).toBe("2");
  });

  it("replaces {antal_personer}", () => {
    expect(applyMessagePlaceholders("{antal_personer}", base)).toBe("3");
  });

  it("replaces all placeholders in one pass", () => {
    const template = "{gæst_navn} booker {shelter_navn} — {antal_nætter} nætter for {antal_personer}";
    const result = applyMessagePlaceholders(template, base);
    expect(result).toContain("Lars Andersen");
    expect(result).toContain("Ørnebjerg Shelter");
    expect(result).toContain("2");
    expect(result).toContain("3");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(applyMessagePlaceholders("{ukendt_felt}", base)).toBe("{ukendt_felt}");
  });

  it("replaces {ankomst_dato} with Danish short format", () => {
    const result = applyMessagePlaceholders("{ankomst_dato}", base);
    // "fre. 22. maj" — weekday short + day + month long in da-DK
    expect(result).toMatch(/\d+\./); // has a day number
    expect(result.toLowerCase()).toContain("maj");
  });

  it("handles XSS in guest name (HTML context)", () => {
    const xss = { ...base, guestName: "<script>alert(1)</script>" };
    const result = applyMessagePlaceholders("Hej {gæst_navn}!", xss);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("handles XSS in shelter title (HTML context)", () => {
    const xss = { ...base, shelterTitle: `Shelter <b>X</b> & "Y"` };
    const result = applyMessagePlaceholders("{shelter_navn}", xss);
    expect(result).toContain("&lt;b&gt;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&quot;");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/booking-auto-messages.test.ts
```

Expected: FAIL — `applyMessagePlaceholders` is not exported yet.

- [ ] **Step 3: Add `applyMessagePlaceholders` to `lib/booking-email.ts`**

Open `web/lib/booking-email.ts`. At the top of the file (after the imports, before the first function), add:

```typescript
// ─── Placeholder replacement ─────────────────────────────────────────────────

export interface AutoMessageContext {
  guestName: string;
  shelterTitle: string;
  checkIn: string;  // ISO date "YYYY-MM-DD"
  checkOut: string; // ISO date "YYYY-MM-DD"
  guestCount: number;
}

/**
 * Replace placeholders in an owner-written template.
 * All dynamic values are HTML-escaped so this output is safe to embed in HTML.
 * Unknown placeholders are left as-is (spec: "ignoreres").
 */
export function applyMessagePlaceholders(
  template: string,
  ctx: AutoMessageContext
): string {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(ctx.checkOut).getTime() - new Date(ctx.checkIn).getTime()) /
        86_400_000
    )
  );

  function fmtDa(iso: string): string {
    return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
      weekday: "short",
      day: "numeric",
      month: "long",
    });
  }

  return template
    .replace(/{gæst_navn}/g, escapeHtml(ctx.guestName))
    .replace(/{shelter_navn}/g, escapeHtml(ctx.shelterTitle))
    .replace(/{ankomst_dato}/g, escapeHtml(fmtDa(ctx.checkIn)))
    .replace(/{afrejse_dato}/g, escapeHtml(fmtDa(ctx.checkOut)))
    .replace(/{antal_nætter}/g, String(nights))
    .replace(/{antal_personer}/g, String(ctx.guestCount));
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/booking-auto-messages.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Also add `sendBookingAutoMessage` to `lib/booking-email.ts`**

After `applyMessagePlaceholders`, add this function to the same file:

```typescript
/**
 * Send an owner-authored auto-message to a guest.
 * Uses applyMessagePlaceholders for subject (plain text) and body (HTML).
 * Throws on Resend error — caller must wrap in try/catch.
 */
export async function sendBookingAutoMessage(opts: {
  guestEmail: string;
  subject: string; // raw owner template
  body: string;    // raw owner template
  ctx: AutoMessageContext;
}) {
  // Subject: plain text — replace placeholders but strip HTML escapes
  // (email subjects are not HTML-rendered)
  function replacePlain(template: string): string {
    const nights = Math.max(
      1,
      Math.round(
        (new Date(opts.ctx.checkOut).getTime() - new Date(opts.ctx.checkIn).getTime()) /
          86_400_000
      )
    );
    function fmtDa(iso: string): string {
      return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    }
    return template
      .replace(/{gæst_navn}/g, opts.ctx.guestName)
      .replace(/{shelter_navn}/g, opts.ctx.shelterTitle)
      .replace(/{ankomst_dato}/g, fmtDa(opts.ctx.checkIn))
      .replace(/{afrejse_dato}/g, fmtDa(opts.ctx.checkOut))
      .replace(/{antal_nætter}/g, String(nights))
      .replace(/{antal_personer}/g, String(opts.ctx.guestCount));
  }

  const subject = replacePlain(opts.subject);

  // Body: HTML — escape template text first, then replace placeholders with escaped values
  const bodyHtml =
    applyMessagePlaceholders(escapeHtml(opts.body), opts.ctx).replace(/\n/g, "<br>") +
    '<p style="color:#999;font-size:12px;margin-top:24px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>';

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject,
    html: `<div style="font-family:sans-serif;max-width:600px;">${bodyHtml}</div>`,
  });

  if (error) {
    throw new Error("Email-fejl (auto-besked): " + JSON.stringify(error));
  }
}
```

**Why two replace approaches:** The subject is plain text (email clients don't render HTML in subjects), so values go in raw. The body is HTML, so we HTML-escape the owner's free text first (preventing XSS from the owner's own template), then the placeholder values are escaped by `applyMessagePlaceholders`.

- [ ] **Step 6: Run full test suite to confirm nothing broke**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add web/lib/booking-email.ts web/lib/__tests__/booking-auto-messages.test.ts
git commit -m "feat: applyMessagePlaceholders + sendBookingAutoMessage — tested placeholder replacement"
```

---

## Task 3: GET / PATCH Messages API Route

**Files:**
- Create: `web/app/api/owner/[token]/messages/route.ts`

- [ ] **Step 1: Create the route file**

Create `web/app/api/owner/[token]/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken } from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

// Default texts shown the first time an owner opens the editor.
// Returned by GET when no template exists yet (not persisted until PATCH).
const DEFAULTS = {
  confirmation_enabled: true,
  confirmation_subject: "Din booking af {shelter_navn} er bekræftet",
  confirmation_body:
    "Hej {gæst_navn},\n\nDin booking er bekræftet — vi glæder os til at byde dig velkommen.\n\nAnkomst: {ankomst_dato}\nAfrejse: {afrejse_dato}\nVarighed: {antal_nætter} nætter\nAntal personer: {antal_personer}\n\nGod tur!",
  reminder_enabled: true,
  reminder_subject: "Reminder: du ankommer til {shelter_navn} i morgen",
  reminder_body:
    "Hej {gæst_navn},\n\nBare en reminder — du ankommer til {shelter_navn} i morgen ({ankomst_dato}).\n\nVi ses!",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("booking_message_templates")
    .select(
      "confirmation_enabled,confirmation_subject,confirmation_body,reminder_enabled,reminder_subject,reminder_body"
    )
    .eq("shelter_id", shelter.id)
    .single();

  // If no template exists yet, return defaults (without persisting them)
  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    confirmation_enabled,
    confirmation_subject,
    confirmation_body,
    reminder_enabled,
    reminder_subject,
    reminder_body,
  } = body as Record<string, unknown>;

  // Validate lengths and required fields
  if (confirmation_enabled) {
    if (!String(confirmation_subject ?? "").trim())
      return NextResponse.json(
        { error: "Bekræftelse: emne må ikke være tomt" },
        { status: 400 }
      );
    if (!String(confirmation_body ?? "").trim())
      return NextResponse.json(
        { error: "Bekræftelse: besked må ikke være tom" },
        { status: 400 }
      );
  }
  if (String(confirmation_subject ?? "").length > 200)
    return NextResponse.json(
      { error: "Bekræftelse: emne må max være 200 tegn" },
      { status: 400 }
    );
  if (String(confirmation_body ?? "").length > 2000)
    return NextResponse.json(
      { error: "Bekræftelse: besked må max være 2000 tegn" },
      { status: 400 }
    );

  if (reminder_enabled) {
    if (!String(reminder_subject ?? "").trim())
      return NextResponse.json(
        { error: "Påmindelse: emne må ikke være tomt" },
        { status: 400 }
      );
    if (!String(reminder_body ?? "").trim())
      return NextResponse.json(
        { error: "Påmindelse: besked må ikke være tom" },
        { status: 400 }
      );
  }
  if (String(reminder_subject ?? "").length > 200)
    return NextResponse.json(
      { error: "Påmindelse: emne må max være 200 tegn" },
      { status: 400 }
    );
  if (String(reminder_body ?? "").length > 2000)
    return NextResponse.json(
      { error: "Påmindelse: besked må max være 2000 tegn" },
      { status: 400 }
    );

  const { error } = await createAdminClient()
    .from("booking_message_templates")
    .upsert(
      {
        shelter_id: shelter.id,
        confirmation_enabled: !!confirmation_enabled,
        confirmation_subject: String(confirmation_subject ?? ""),
        confirmation_body: String(confirmation_body ?? ""),
        reminder_enabled: !!reminder_enabled,
        reminder_subject: String(reminder_subject ?? ""),
        reminder_body: String(reminder_body ?? ""),
      },
      { onConflict: "shelter_id" }
    );

  if (error) {
    console.error("messages PATCH error:", error);
    return NextResponse.json({ error: "Kunne ikke gemme" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Test the route manually**

Start the dev server (`npm run dev`) and test with curl:

```bash
# Replace TOKEN with a real owner_token from your Supabase bookable_shelters table
TOKEN="your-owner-token-here"

# GET — should return DEFAULTS if no template exists
curl -s http://localhost:3000/api/owner/$TOKEN/messages | jq .

# PATCH — save a template
curl -s -X PATCH http://localhost:3000/api/owner/$TOKEN/messages \
  -H "Content-Type: application/json" \
  -d '{"confirmation_enabled":true,"confirmation_subject":"Test emne {shelter_navn}","confirmation_body":"Hej {gæst_navn}!","reminder_enabled":false,"reminder_subject":"","reminder_body":""}' | jq .

# GET again — should return saved template
curl -s http://localhost:3000/api/owner/$TOKEN/messages | jq .
```

Expected: GET returns saved values, PATCH returns `{ "ok": true }`.

Test validation:
```bash
# Should fail: confirmation enabled but empty subject
curl -s -X PATCH http://localhost:3000/api/owner/$TOKEN/messages \
  -H "Content-Type: application/json" \
  -d '{"confirmation_enabled":true,"confirmation_subject":"","confirmation_body":"Test","reminder_enabled":false,"reminder_subject":"","reminder_body":""}' | jq .
```

Expected: `{ "error": "Bekræftelse: emne må ikke være tomt" }` with status 400.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/owner/\[token\]/messages/route.ts
git commit -m "feat: GET/PATCH /api/owner/[token]/messages — template editor API"
```

---

## Task 4: Extend Action Route — Send Auto-Message on Confirm

**Files:**
- Modify: `web/app/api/owner/[token]/action/route.ts`

- [ ] **Step 1: Add imports**

At the top of `web/app/api/owner/[token]/action/route.ts`, add these two imports (after the existing imports):

```typescript
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendBookingAutoMessage } from "@/lib/booking-email";
```

The file already imports from `@/lib/booking-email` — add `sendBookingAutoMessage` to that import line instead of a second import. The existing import is:
```typescript
import {
  sendBookingRejectedToGuest,
  sendBookingConfirmedToGuest,
  sendPaymentRequestToGuest,
  sendRefundedToGuest,
} from "@/lib/booking-email";
```

Change it to:
```typescript
import {
  sendBookingRejectedToGuest,
  sendBookingConfirmedToGuest,
  sendPaymentRequestToGuest,
  sendRefundedToGuest,
  sendBookingAutoMessage,
} from "@/lib/booking-email";
import { createAdminClient } from "@/utils/supabase/server-admin";
```

- [ ] **Step 2: Add helper function `sendAutoMessageIfEnabled`**

After the `calcNights` function (around line 21), add:

```typescript
/**
 * Look up the owner's message template for this shelter and send the
 * confirmation auto-message if it is enabled.
 * Returns true if sent, false if skipped, never throws (email errors are logged).
 */
async function sendAutoMessageIfEnabled(
  bookableShelterDbId: string,
  booking: { guest_email: string; guest_name: string; check_in: string; check_out: string; guest_count: number },
  shelterTitle: string
): Promise<boolean> {
  try {
    const { data: template } = await createAdminClient()
      .from("booking_message_templates")
      .select("confirmation_enabled,confirmation_subject,confirmation_body")
      .eq("shelter_id", bookableShelterDbId)
      .single();

    if (!template?.confirmation_enabled) return false;
    if (!template.confirmation_subject?.trim() || !template.confirmation_body?.trim()) return false;

    await sendBookingAutoMessage({
      guestEmail: booking.guest_email,
      subject: template.confirmation_subject,
      body: template.confirmation_body,
      ctx: {
        guestName: booking.guest_name,
        shelterTitle,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestCount: booking.guest_count,
      },
    });

    return true;
  } catch (err) {
    console.error("sendAutoMessageIfEnabled error:", err);
    return false;
  }
}
```

- [ ] **Step 3: Call helper in the `upfront` confirm branch**

Find the upfront branch (around line 55–68). It currently ends with:
```typescript
      return NextResponse.json({ ok: true });
```

Change it to:
```typescript
      const confirmationEmailSent = await sendAutoMessageIfEnabled(
        shelter.id, booking, shelter.title
      );
      return NextResponse.json({ ok: true, confirmationEmailSent });
```

The full upfront block should look like:
```typescript
    if (shelter.payment_mode === "upfront") {
      await updateBookingStatus(bookingId, "confirmed");
      try {
        await sendBookingConfirmedToGuest({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
        });
      } catch (err) {
        console.error("owner confirm (upfront): confirmation email error:", err);
      }
      const confirmationEmailSent = await sendAutoMessageIfEnabled(
        shelter.id, booking, shelter.title
      );
      return NextResponse.json({ ok: true, confirmationEmailSent });
    }
```

- [ ] **Step 4: Call helper in the `after_confirmation` confirm branch**

Find the after_confirmation branch. It currently ends with:
```typescript
        await sendPaymentRequestToGuest({ ... });
      } catch (err) {
        ...
        return NextResponse.json({ error: ... }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
```

Change the final `return NextResponse.json({ ok: true });` at the end of the confirm block to:

```typescript
    const confirmationEmailSent = await sendAutoMessageIfEnabled(
      shelter.id, booking, shelter.title
    );
    return NextResponse.json({ ok: true, confirmationEmailSent });
```

This must be placed **after** the try/catch block for the Stripe session (not inside it). The after_confirmation try/catch already returns early on error, so this code only runs on success.

**Note:** The `return NextResponse.json({ ok: true });` at line 108 in the original file is the general confirm response. You are replacing that with the two lines above. Make sure the return is outside the `if (shelter.payment_mode === "upfront")` block.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Run test suite**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Manual smoke test**

1. In Supabase, ensure the test shelter has a `booking_message_templates` row with `confirmation_enabled = true` and a valid subject/body
2. Confirm a pending booking in the owner dashboard
3. Verify the auto-message email arrives at the guest email address

- [ ] **Step 8: Commit**

```bash
git add web/app/api/owner/\[token\]/action/route.ts
git commit -m "feat: send auto confirmation email on booking confirm"
```

---

## Task 5: Netlify Scheduled Function — send-reminders

**Files:**
- Create: `web/netlify/functions/send-reminders.mts`

- [ ] **Step 1: Create the function**

Create `web/netlify/functions/send-reminders.mts`:

```typescript
import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { sendBookingAutoMessage, applyMessagePlaceholders } from "../../lib/booking-email";

// Note: This function authenticates with Supabase directly using the service role key.
// Netlify Scheduled Functions are called internally by Netlify's scheduler — no HTTP
// headers to verify. The service role key acts as the auth credential.

const handler: Handler = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Tomorrow in YYYY-MM-DD (UTC)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Fetch all confirmed bookings for tomorrow that haven't been sent a reminder yet
  const { data: bookings, error: fetchError } = await supabase
    .from("shelter_bookings")
    .select("id, guest_name, guest_email, guest_count, check_in, check_out, bookable_shelter_id")
    .eq("check_in", tomorrow)
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);

  if (fetchError) {
    console.error("send-reminders: fetch bookings error:", fetchError);
    return { statusCode: 500, body: "fetch error: " + fetchError.message };
  }

  const rows = bookings ?? [];
  console.log(`send-reminders: ${rows.length} booking(s) for ${tomorrow}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of rows) {
    try {
      // Get shelter title
      const { data: shelter } = await supabase
        .from("bookable_shelters")
        .select("title")
        .eq("id", booking.bookable_shelter_id)
        .single();

      // Get template — skip if none or reminder disabled
      const { data: template } = await supabase
        .from("booking_message_templates")
        .select("reminder_enabled, reminder_subject, reminder_body")
        .eq("shelter_id", booking.bookable_shelter_id)
        .single();

      if (!template?.reminder_enabled) {
        skipped++;
        continue;
      }
      if (!template.reminder_subject?.trim() || !template.reminder_body?.trim()) {
        skipped++;
        continue;
      }
      if (!shelter) {
        console.warn(`send-reminders: shelter not found for booking ${booking.id}`);
        skipped++;
        continue;
      }

      await sendBookingAutoMessage({
        guestEmail: booking.guest_email,
        subject: template.reminder_subject,
        body: template.reminder_body,
        ctx: {
          guestName: booking.guest_name,
          shelterTitle: shelter.title,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          guestCount: booking.guest_count,
        },
      });

      // Mark as sent — only AFTER successful send (idempotency guard)
      const { error: updateError } = await supabase
        .from("shelter_bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (updateError) {
        console.error(`send-reminders: failed to mark sent for booking ${booking.id}:`, updateError);
        // Don't increment failed — email was sent, just the DB update failed
      }

      sent++;
    } catch (err) {
      console.error(`send-reminders: error for booking ${booking.id}:`, err);
      failed++;
      // Continue with next booking — one failure doesn't stop the rest
    }
  }

  const summary = `send-reminders done: ${sent} sent, ${skipped} skipped, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

export default schedule("0 8 * * *", handler); // 08:00 UTC daily
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verify Netlify function is detected**

```bash
cd /Users/CKA/shelterdk/web && cat netlify.toml | grep -A2 functions
```

Expected: `directory = "netlify/functions"` — the function will be auto-discovered.

- [ ] **Step 4: Commit**

```bash
git add web/netlify/functions/send-reminders.mts
git commit -m "feat: Netlify scheduled function send-reminders — daily 08:00 UTC reminder emails"
```

---

## Task 6: Dashboard UI — Messages Editor Section

**Files:**
- Modify: `web/components/owner/OwnerDashboard.tsx`

This is the largest task. Add: state for templates, a fetch-on-mount effect, a save handler, placeholder chip insertion logic, live preview, and the JSX section. Follow the exact same pattern as the `pricePerNight` / `handlePriceSave` section.

- [ ] **Step 1: Add imports**

Open `web/components/owner/OwnerDashboard.tsx`. The first line is:
```typescript
import { useState, useCallback, useEffect } from "react";
```

Change it to:
```typescript
import { useState, useCallback, useEffect, useRef } from "react";
```

- [ ] **Step 2: Add `MsgTemplates` interface and state variables**

Find the `// Price settings state` comment block (around line 215). After the price state block (after `const [priceMsg, setPriceMsg]...`), add:

```typescript
  // Messages (auto-beskeder) state
  interface MsgTemplates {
    confirmation_enabled: boolean;
    confirmation_subject: string;
    confirmation_body: string;
    reminder_enabled: boolean;
    reminder_subject: string;
    reminder_body: string;
  }
  const [msgTemplates, setMsgTemplates] = useState<MsgTemplates | null>(null);
  const [msgOriginal, setMsgOriginal] = useState<MsgTemplates | null>(null);
  const [msgSaving, setMsgSaving] = useState(false);
  const [msgSaved, setMsgSaved] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Refs for cursor-position tracking (placeholder chip insertion)
  const confSubjRef = useRef<HTMLInputElement>(null);
  const confBodyRef = useRef<HTMLTextAreaElement>(null);
  const remSubjRef = useRef<HTMLInputElement>(null);
  const remBodyRef = useRef<HTMLTextAreaElement>(null);
  type MsgField = "conf_subj" | "conf_body" | "rem_subj" | "rem_body";
  const [activeMsgField, setActiveMsgField] = useState<MsgField | null>(null);

  // confirmationEmailSent badge — tracks which booking IDs had auto-email sent this session
  const [confirmedWithEmail, setConfirmedWithEmail] = useState<Set<string>>(new Set());
```

**Important:** Place the `interface MsgTemplates` declaration **inside** the component function (it's fine in TypeScript and avoids module-level pollution).

- [ ] **Step 3: Add fetch-on-mount effect for templates**

Find the `useEffect(() => { fetchPayments(); }...` line (around line 285). After it, add:

```typescript
  useEffect(() => {
    fetch(`/api/owner/${ownerToken}/messages`)
      .then((r) => r.json())
      .then((data: MsgTemplates) => {
        setMsgTemplates(data);
        setMsgOriginal(data);
      })
      .catch(() => {});
  }, [ownerToken]);
```

- [ ] **Step 4: Add save handler and placeholder insertion helper**

After `handleIcalSync` (around line 350), add these two functions:

```typescript
  const handleMsgSave = async () => {
    if (!msgTemplates) return;
    setMsgSaving(true);
    setMsgError(null);
    setMsgSaved(false);
    try {
      const res = await fetch(`/api/owner/${ownerToken}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgTemplates),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgError(data.error ?? "Noget gik galt");
      } else {
        setMsgOriginal(msgTemplates);
        setMsgSaved(true);
        setTimeout(() => setMsgSaved(false), 3000);
      }
    } catch {
      setMsgError("Noget gik galt");
    } finally {
      setMsgSaving(false);
    }
  };

  const insertMsgPlaceholder = (placeholder: string) => {
    if (!activeMsgField || !msgTemplates) return;
    const refMap: Record<MsgField, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
      conf_subj: confSubjRef as React.RefObject<HTMLInputElement | null>,
      conf_body: confBodyRef as React.RefObject<HTMLTextAreaElement | null>,
      rem_subj: remSubjRef as React.RefObject<HTMLInputElement | null>,
      rem_body: remBodyRef as React.RefObject<HTMLTextAreaElement | null>,
    };
    const fieldMap: Record<MsgField, keyof MsgTemplates> = {
      conf_subj: "confirmation_subject",
      conf_body: "confirmation_body",
      rem_subj: "reminder_subject",
      rem_body: "reminder_body",
    };
    const el = refMap[activeMsgField].current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const field = fieldMap[activeMsgField];
    const current = String(msgTemplates[field]);
    const newValue = current.slice(0, start) + placeholder + current.slice(end);
    setMsgTemplates((prev) => (prev ? { ...prev, [field]: newValue } : null));
    // Restore focus and cursor position after React re-renders
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };
```

- [ ] **Step 5: Update `handleAction` to capture `confirmationEmailSent`**

Find `handleAction` (around line 353). It currently reads:
```typescript
    const data = await res.json();
    setActingId(null);
    if (!res.ok) { setActionError(data.error ?? "Fejl"); return; }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: action === "confirm" ? "confirmed" : "rejected" }
          : b
      )
    );
    if (action === "confirm") fetchPayments();
```

Add two lines after `if (action === "confirm") fetchPayments();`:
```typescript
    if (action === "confirm" && data.confirmationEmailSent) {
      setConfirmedWithEmail((prev) => new Set([...prev, bookingId]));
    }
```

- [ ] **Step 6: Add preview helper function**

Inside the component function, after the `timeAgo` function (around line 274), add:

```typescript
  function previewMsg(template: string): string {
    // Use example values for live preview
    const previewCheckIn = new Date();
    previewCheckIn.setDate(previewCheckIn.getDate() + 1);
    const previewCheckOut = new Date(previewCheckIn);
    previewCheckOut.setDate(previewCheckIn.getDate() + 2);
    const fmtDa = (d: Date) =>
      d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "long" });
    return template
      .replace(/{gæst_navn}/g, "Lars")
      .replace(/{shelter_navn}/g, shelter.title)
      .replace(/{ankomst_dato}/g, fmtDa(previewCheckIn))
      .replace(/{afrejse_dato}/g, fmtDa(previewCheckOut))
      .replace(/{antal_nætter}/g, "2")
      .replace(/{antal_personer}/g, "3");
  }
```

- [ ] **Step 7: Add badge to confirmed booking cards**

In the confirmed/upcoming bookings section, find where confirmed bookings are rendered (around line 640–730 in the original file). Look for the status badge for confirmed bookings. There's a section that renders payment status. Find the block that shows the "Bekræftet" badge:

```tsx
                    {!payment && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        Bekræftet
                      </span>
                    )}
```

Change it to:
```tsx
                    {!payment && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        Bekræftet
                      </span>
                    )}
                    {confirmedWithEmail.has(b.id) && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                        ✓ Velkomstmail sendt
                      </span>
                    )}
```

- [ ] **Step 8: Add the messages section JSX**

Find the end of the file, just before the closing `</div>` of the main return (around line 902). The last section before the close is either the embed code section or the iCal section. Add the messages section **after** the iCal / embed section:

```tsx
      {/* ── Automatiske beskeder ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5 space-y-6">
        <div>
          <h2 className="font-serif text-lg font-bold text-primary mb-0.5">Automatiske beskeder</h2>
          <p className="text-xs text-primary/40">
            Skriv personlige emails der sendes automatisk til gæster. Brug pladsholdere til at indsætte navne og datoer.
          </p>
        </div>

        {msgTemplates === null ? (
          <p className="text-sm text-primary/40">Henter…</p>
        ) : (
          <>
            {/* Placeholder chips */}
            {(() => {
              const PLACEHOLDERS = [
                { label: "{gæst_navn}", title: "Gæstens navn" },
                { label: "{shelter_navn}", title: "Shelterets navn" },
                { label: "{ankomst_dato}", title: "Ankomstdato" },
                { label: "{afrejse_dato}", title: "Afrejsedato" },
                { label: "{antal_nætter}", title: "Antal nætter" },
                { label: "{antal_personer}", title: "Antal personer" },
              ];
              return (
                <div>
                  <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-2">
                    Pladsholdere — klik for at indsætte ved cursoren
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        title={p.title}
                        onClick={() => insertMsgPlaceholder(p.label)}
                        className="rounded-lg border border-primary/15 bg-primary/[0.03] px-2.5 py-1 text-xs font-mono text-primary/70 hover:bg-accent/5 hover:border-accent/30 hover:text-accent transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Bekræftelsesbesked ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${msgTemplates.confirmation_enabled ? "border-primary/10 bg-white" : "border-primary/6 bg-primary/[0.02]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Bekræftelsesbesked</p>
                  <p className="text-xs text-primary/40">Sendes til gæsten når du bekræfter en booking</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={msgTemplates.confirmation_enabled}
                    onChange={(e) =>
                      setMsgTemplates((prev) =>
                        prev ? { ...prev, confirmation_enabled: e.target.checked } : null
                      )
                    }
                  />
                  <div className={`h-5 w-9 rounded-full transition-colors ${msgTemplates.confirmation_enabled ? "bg-accent" : "bg-primary/20"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${msgTemplates.confirmation_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs text-primary/50">{msgTemplates.confirmation_enabled ? "Til" : "Fra"}</span>
                </label>
              </div>

              {msgTemplates.confirmation_enabled ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
                      Emne
                    </label>
                    <input
                      ref={confSubjRef}
                      type="text"
                      value={msgTemplates.confirmation_subject}
                      maxLength={200}
                      onFocus={() => setActiveMsgField("conf_subj")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, confirmation_subject: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                      placeholder="Emne til bekræftelses-email"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.confirmation_subject.length}/200</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
                      Besked
                    </label>
                    <textarea
                      ref={confBodyRef}
                      value={msgTemplates.confirmation_body}
                      maxLength={2000}
                      rows={5}
                      onFocus={() => setActiveMsgField("conf_body")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, confirmation_body: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-y"
                      placeholder="Skriv din besked til gæsten…"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.confirmation_body.length}/2000</p>
                  </div>
                  {/* Live preview */}
                  {(msgTemplates.confirmation_subject || msgTemplates.confirmation_body) && (
                    <div>
                      <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Preview</p>
                      <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 text-sm text-primary/70 space-y-1">
                        {msgTemplates.confirmation_subject && (
                          <p className="font-semibold text-primary text-xs">
                            {previewMsg(msgTemplates.confirmation_subject)}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">
                          {previewMsg(msgTemplates.confirmation_body)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-primary/40 italic">Beskeden er slået fra — gæsten modtager ingen automatisk bekræftelsesmail.</p>
              )}
            </div>

            {/* ── Påmindelsesbesked ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${msgTemplates.reminder_enabled ? "border-primary/10 bg-white" : "border-primary/6 bg-primary/[0.02]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Påmindelsesbesked</p>
                  <p className="text-xs text-primary/40">Sendes automatisk dagen før gæstens ankomst</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={msgTemplates.reminder_enabled}
                    onChange={(e) =>
                      setMsgTemplates((prev) =>
                        prev ? { ...prev, reminder_enabled: e.target.checked } : null
                      )
                    }
                  />
                  <div className={`h-5 w-9 rounded-full transition-colors ${msgTemplates.reminder_enabled ? "bg-accent" : "bg-primary/20"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${msgTemplates.reminder_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs text-primary/50">{msgTemplates.reminder_enabled ? "Til" : "Fra"}</span>
                </label>
              </div>

              {msgTemplates.reminder_enabled ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
                      Emne
                    </label>
                    <input
                      ref={remSubjRef}
                      type="text"
                      value={msgTemplates.reminder_subject}
                      maxLength={200}
                      onFocus={() => setActiveMsgField("rem_subj")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, reminder_subject: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                      placeholder="Emne til påmindelses-email"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.reminder_subject.length}/200</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
                      Besked
                    </label>
                    <textarea
                      ref={remBodyRef}
                      value={msgTemplates.reminder_body}
                      maxLength={2000}
                      rows={4}
                      onFocus={() => setActiveMsgField("rem_body")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, reminder_body: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-y"
                      placeholder="Skriv din påmindelsesbesked…"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.reminder_body.length}/2000</p>
                  </div>
                  {/* Live preview */}
                  {(msgTemplates.reminder_subject || msgTemplates.reminder_body) && (
                    <div>
                      <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Preview</p>
                      <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 text-sm text-primary/70 space-y-1">
                        {msgTemplates.reminder_subject && (
                          <p className="font-semibold text-primary text-xs">
                            {previewMsg(msgTemplates.reminder_subject)}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">
                          {previewMsg(msgTemplates.reminder_body)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-primary/40 italic">Beskeden er slået fra — gæsten modtager ingen automatisk påmindelsesmail.</p>
              )}
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleMsgSave}
                disabled={
                  msgSaving ||
                  JSON.stringify(msgTemplates) === JSON.stringify(msgOriginal)
                }
                className="rounded-xl bg-accent text-white px-5 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
              >
                {msgSaving ? "Gemmer…" : "Gem beskeder"}
              </button>
              {msgSaved && (
                <span className="text-sm text-emerald-600 font-medium">✓ Beskeder gemt</span>
              )}
            </div>

            {msgError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
                {msgError}
              </div>
            )}
          </>
        )}
      </section>
```

- [ ] **Step 9: Check TypeScript compiles**

```bash
cd /Users/CKA/shelterdk/web && npx tsc --noEmit
```

Expected: No errors. If there are type errors with the refs, check that `confSubjRef` and `remSubjRef` are typed as `useRef<HTMLInputElement>(null)` and `confBodyRef`/`remBodyRef` as `useRef<HTMLTextAreaElement>(null)`.

- [ ] **Step 10: Run test suite**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 11: Visual verification**

1. Open the owner dashboard in browser (`/owner/[token]`)
2. Scroll to the new "Automatiske beskeder" section at the bottom
3. Verify:
   - Default texts are pre-filled
   - Toggle on/off works and greys out fields
   - Preview updates live as you type
   - Character counters update
   - Clicking a placeholder chip inserts text at cursor position
   - "Gem beskeder" is disabled until a change is made
   - After save: "✓ Beskeder gemt" appears for 3 seconds
   - After confirming a booking with a template enabled: "✓ Velkomstmail sendt" badge appears on the booking card

- [ ] **Step 12: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat: messages editor UI in OwnerDashboard — toggles, previews, placeholder chips"
```

---

## Final Verification Checklist

- [ ] Migration applied: `booking_message_templates` table + `reminder_sent_at` column exist in Supabase
- [ ] `applyMessagePlaceholders` tests pass: `npx vitest run`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] GET `/api/owner/[token]/messages` returns defaults for new shelters
- [ ] PATCH saves templates and GET returns saved values
- [ ] Confirming a booking sends auto-message email to guest (if template enabled)
- [ ] `send-reminders.mts` is visible in Netlify Functions tab after deploy
- [ ] Dashboard UI renders, toggles work, preview updates live, save works
- [ ] "✓ Velkomstmail sendt" badge appears after confirming a booking with template enabled

---

## Out of Scope (Not Built)

Per spec:
- Push notifications / SMS
- Message history / log for owner
- Reply-to set to owner email
- Thank-you email after check-out
- Manual trigger endpoint for testing cron
