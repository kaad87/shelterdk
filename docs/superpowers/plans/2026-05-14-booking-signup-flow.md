# Booking Sign-up Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let shelter owners sign up for the ShelterDK booking system — either as an opt-in step inside the existing `/opret-shelter` form, or via a standalone `/aktiver-booking` page for owners already listed on the site.

**Architecture:** Two independent entry points sharing a thin email layer. Flow 1 adds a `wants_booking` boolean to `shelter_submissions` and renders a collapsible section 5 in `ShelterSubmissionForm`. Flow 2 is a standalone page + API route (`/api/activate-booking`) that sends an admin notification and an owner confirmation email — no new DB table, since the admin manually activates booking for existing shelters. Both flows reference the same samarbejdsvilkår text and 20 kr. servicegebyr disclosure.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (admin client), Resend (via existing `sendLoggedEmail`), Vitest, Tailwind (tokens: `primary=#2C3E50`, `accent=#C5A059`, `background=#F9FAFB`, font: DM Sans).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `web/migrations/20260514_shelter_submissions_wants_booking.sql` | Create | Add `wants_booking` column |
| `web/lib/shelter-submissions.ts` | Modify | Add `wants_booking` to interface + payload |
| `web/lib/email.ts` | Modify | Add 2 email helpers for booking activation |
| `web/lib/__tests__/booking-activation-email.test.ts` | Create | Test new email builders |
| `web/app/api/activate-booking/route.ts` | Create | POST handler — validate, send emails |
| `web/app/api/__tests__/activate-booking.test.ts` | Create | Route unit tests |
| `web/app/api/submit-shelter/route.ts` | Modify | Accept + store `wants_booking` |
| `web/components/ShelterSubmissionForm.tsx` | Modify | Add collapsible section 5 |
| `web/components/BookingActivationForm.tsx` | Create | Standalone sign-up form (client) |
| `web/app/(site)/aktiver-booking/page.tsx` | Create | Landing page + metadata |
| `web/app/(site)/admin/shelter-ansogninger/page.tsx` | Modify | Show "Ønsker bookingsystem" badge |

---

## Samarbejdsvilkår canonical text

Both forms display identical vilkår. Use this exact wording in both components:

```
Gratis for dig som ejer. Ingen oprettelsespris, abonnement eller skjulte omkostninger.
Ingen lejeopkrævning. Du stiller dit shelter gratis til rådighed og opkræver ingen leje.
Automatisk administration. ShelterDK håndterer al betaling og kommunikation med gæsten.
Afmelding. Begge parter kan til enhver tid opsige med 1 måneds varsel.
Servicegebyr. For at dække drift og administration opkræves et servicegebyr på 20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er ikke involveret i betalingstransaktionen.
Aflysninger. Gæsten kan aflyse gratis op til 24 timer før. Aflyser du, refunderes gæsten altid fuldt ud.
GDPR. Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende til administration af overnatningerne.
```

---

## Task 1: DB migration — `wants_booking` column

**Files:**
- Create: `web/migrations/20260514_shelter_submissions_wants_booking.sql`
- Modify: `web/lib/shelter-submissions.ts`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/20260514_shelter_submissions_wants_booking.sql
ALTER TABLE shelter_submissions
  ADD COLUMN IF NOT EXISTS wants_booking boolean not null default false;
```

- [ ] **Step 2: Apply manually in Supabase SQL editor**

Paste the SQL into the Supabase dashboard SQL editor and run it.
Note in a comment that this must run before deploying Task 3/7.

- [ ] **Step 3: Update `ShelterSubmission` interface and payload**

In `web/lib/shelter-submissions.ts`, add `wants_booking` to both types:

```typescript
// In ShelterSubmission interface — add after shelter_id:
wants_booking: boolean;

// In SubmitShelterPayload interface — add after contact_email:
wants_booking?: boolean;
```

- [ ] **Step 4: Commit**

```bash
git add web/migrations/20260514_shelter_submissions_wants_booking.sql web/lib/shelter-submissions.ts
git commit -m "feat: add wants_booking column to shelter_submissions"
```

---

## Task 2: Email helpers for booking activation

**Files:**
- Modify: `web/lib/email.ts`
- Create: `web/lib/__tests__/booking-activation-email.test.ts`

### Email 1 — Admin notification

When an owner submits via `/aktiver-booking`, send an internal alert to `hej@shelterdk.dk`.

### Email 2 — Owner confirmation

Confirm to the owner that we received their request and will be in touch within 2 business days.

- [ ] **Step 1: Write failing tests**

Create `web/lib/__tests__/booking-activation-email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildBookingActivationAdminHtml,
  buildBookingActivationConfirmHtml,
} from "@/lib/email";

describe("buildBookingActivationAdminHtml", () => {
  const opts = {
    name: "Christian Kaad",
    organisation: "Geopark Odsherred",
    email: "christian@example.dk",
    shelterName: "Skovhytten",
    message: "Gerne hurtigt",
  };

  it("includes shelter name", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Skovhytten");
  });
  it("includes organisation", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Geopark Odsherred");
  });
  it("includes email", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("christian@example.dk");
  });
  it("includes optional message", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Gerne hurtigt");
  });
  it("escapes HTML in name", () => {
    expect(
      buildBookingActivationAdminHtml({ ...opts, name: "<script>" })
    ).not.toContain("<script>");
  });
});

describe("buildBookingActivationConfirmHtml", () => {
  const opts = { name: "Christian Kaad", shelterName: "Skovhytten" };

  it("includes shelter name", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("Skovhytten");
  });
  it("includes name", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("Christian Kaad");
  });
  it("mentions 2 hverdage", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("2 hverdage");
  });
  it("includes signature shelterdk.dk", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("shelterdk.dk");
  });
  it("escapes HTML in shelter name", () => {
    expect(
      buildBookingActivationConfirmHtml({ ...opts, shelterName: "<b>xss</b>" })
    ).not.toContain("<b>xss</b>");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web && npx vitest run lib/__tests__/booking-activation-email.test.ts
```
Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Implement email builders in `web/lib/email.ts`**

Append after the existing shelter email functions:

```typescript
// ─── Booking activation emails ────────────────────────────────────────────────

export function buildBookingActivationAdminHtml(opts: {
  name: string;
  organisation: string;
  email: string;
  shelterName: string;
  message?: string | null;
}): string {
  const { name, organisation, email, shelterName, message } = opts;
  return renderEmail({
    title: "Ny forespørgsel: bookingsystem",
    preheader: `${escapeHtml(name)} ønsker bookingsystem for ${escapeHtml(shelterName)}`,
    bodyHtml: `
      <p>En shelter-ejer har anmodet om at få bookingsystemet aktiveret.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px">Navn</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Organisation</td><td>${escapeHtml(organisation)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Shelter</td><td>${escapeHtml(shelterName)}</td></tr>
        ${message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Besked</td><td>${escapeHtml(message)}</td></tr>` : ""}
      </table>
      <p style="margin-top:16px">Aktiver bookingsystemet på shelterets admin-side og svar ejeren direkte på ovenstående email.</p>
    `,
  });
}

export function buildBookingActivationConfirmHtml(opts: {
  name: string;
  shelterName: string;
}): string {
  const { name, shelterName } = opts;
  return renderEmail({
    title: "Vi har modtaget din forespørgsel",
    preheader: `Tak for din interesse i bookingsystemet til ${escapeHtml(shelterName)}`,
    bodyHtml: `
      <p>Hej ${escapeHtml(name)},</p>
      <p>Tak for din interesse i at tilmelde <strong>${escapeHtml(shelterName)}</strong> til ShelterDKs bookingsystem.</p>
      <p>Vi gennemgår din forespørgsel og vender tilbage til dig inden for <strong>2 hverdage</strong>.</p>
      <p>Har du spørgsmål i mellemtiden, er du velkommen til at skrive til <a href="mailto:hej@shelterdk.dk">hej@shelterdk.dk</a>.</p>
      <p>Med venlig hilsen,<br>Christian, ShelterDK · shelterdk.dk</p>
    `,
  });
}

export async function sendBookingActivationEmails(opts: {
  name: string;
  organisation: string;
  email: string;
  shelterName: string;
  message?: string | null;
}): Promise<void> {
  const { name, organisation, email, shelterName, message } = opts;

  // Admin notification
  await sendLoggedEmail({
    to: FROM_EMAIL, // hej@shelterdk.dk
    replyTo: email,
    subject: `Bookingsystem-forespørgsel: ${shelterName}`,
    html: buildBookingActivationAdminHtml({ name, organisation, email, shelterName, message }),
    context: { category: "contact", emailType: "booking_activation_request" },
  });

  // Owner confirmation
  await sendLoggedEmail({
    to: email,
    subject: "Vi har modtaget din forespørgsel om bookingsystem",
    html: buildBookingActivationConfirmHtml({ name, shelterName }),
    context: { category: "contact", emailType: "booking_activation_confirm" },
  });
}
```

- [ ] **Step 4: Run tests — confirm passing**

```bash
cd web && npx vitest run lib/__tests__/booking-activation-email.test.ts
```
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/email.ts web/lib/__tests__/booking-activation-email.test.ts
git commit -m "feat: add booking activation email builders and sender"
```

---

## Task 3: `POST /api/activate-booking` route

**Files:**
- Create: `web/app/api/activate-booking/route.ts`
- Create: `web/app/api/__tests__/activate-booking.test.ts`

### Validation rules
- `name`: required, string, max 200 chars
- `organisation`: required, string, max 200 chars
- `email`: required, valid email format
- `shelterName`: required, string, max 200 chars
- `message`: optional, max 1000 chars
- Rate limit: 3 requests/min per IP (same pattern as `submit-shelter/route.ts`)

- [ ] **Step 1: Write failing tests**

Create `web/app/api/__tests__/activate-booking.test.ts`:

```typescript
// web/app/api/__tests__/activate-booking.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendBookingActivationEmails: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import("../activate-booking/route");

function req(body: unknown): Request {
  return new Request("http://localhost/api/activate-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  name: "Christian Kaad",
  organisation: "Geopark Odsherred",
  email: "christian@example.dk",
  shelterName: "Skovhytten",
};

describe("POST /api/activate-booking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 400 uden navn", async () => {
    const res = await POST(req({ ...VALID, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden organisation", async () => {
    const res = await POST(req({ ...VALID, organisation: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 med ugyldig email", async () => {
    const res = await POST(req({ ...VALID, email: "notanemail" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden shelterName", async () => {
    const res = await POST(req({ ...VALID, shelterName: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 hvis besked er over 1000 tegn", async () => {
    const res = await POST(req({ ...VALID, message: "x".repeat(1001) }));
    expect(res.status).toBe(400);
  });

  it("returnerer 201 ved gyldigt request", async () => {
    const res = await POST(req(VALID));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("sender emails ved gyldigt request", async () => {
    const { sendBookingActivationEmails } = await import("@/lib/email");
    await POST(req(VALID));
    expect(sendBookingActivationEmails).toHaveBeenCalledWith(
      expect.objectContaining({ email: "christian@example.dk", shelterName: "Skovhytten" })
    );
  });

  it("returnerer 201 med valgfri besked", async () => {
    const res = await POST(req({ ...VALID, message: "Hurtigst muligt tak" }));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web && npx vitest run app/api/__tests__/activate-booking.test.ts
```
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

Create `web/app/api/activate-booking/route.ts`:

```typescript
// web/app/api/activate-booking/route.ts
import { sendBookingActivationEmails } from "@/lib/email";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting — 3 submissions/min per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const ipTimestamps = new Map<string, number[]>();

export async function POST(request: Request) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange forsøg. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  let body: {
    name?: string;
    organisation?: string;
    email?: string;
    shelterName?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 200) {
    return Response.json({ error: "Navn er påkrævet (maks 200 tegn)" }, { status: 400 });
  }

  const organisation = body.organisation?.trim();
  if (!organisation || organisation.length > 200) {
    return Response.json({ error: "Organisation er påkrævet (maks 200 tegn)" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: "Ugyldig email-adresse" }, { status: 400 });
  }

  const shelterName = body.shelterName?.trim();
  if (!shelterName || shelterName.length > 200) {
    return Response.json({ error: "Shelterets navn er påkrævet (maks 200 tegn)" }, { status: 400 });
  }

  const message = body.message?.trim() || null;
  if (message && message.length > 1000) {
    return Response.json({ error: "Besked må højst være 1000 tegn" }, { status: 400 });
  }

  try {
    await sendBookingActivationEmails({ name, organisation, email, shelterName, message });
  } catch (err) {
    console.error("Booking activation email failed:", err);
    return Response.json({ error: "Noget gik galt — prøv igen" }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 4: Run tests — confirm passing**

```bash
cd web && npx vitest run app/api/__tests__/activate-booking.test.ts
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/activate-booking/route.ts web/app/api/__tests__/activate-booking.test.ts
git commit -m "feat: POST /api/activate-booking with validation and email"
```

---

## Task 4: `BookingActivationForm` component

**Files:**
- Create: `web/components/BookingActivationForm.tsx`

This is a `"use client"` form that posts to `/api/activate-booking`. On success shows a thank-you screen. Matches the ShelterDK design system exactly.

- [ ] **Step 1: Create component**

```typescript
// web/components/BookingActivationForm.tsx
"use client";

import { useState } from "react";

const VILKAR = [
  { label: "Gratis for dig som ejer.", text: "Ingen oprettelsespris, abonnement eller skjulte omkostninger." },
  { label: "Ingen lejeopkrævning.", text: "Du stiller dit shelter gratis til rådighed og opkræver ingen leje." },
  { label: "Automatisk administration.", text: "ShelterDK håndterer al betaling og kommunikation med gæsten." },
  { label: "Afmelding.", text: "Begge parter kan til enhver tid opsige med 1 måneds varsel." },
  { label: "Servicegebyr.", text: "For at dække drift og administration opkræves et servicegebyr på 20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er ikke involveret i betalingstransaktionen." },
  { label: "Aflysninger.", text: "Gæsten kan aflyse gratis op til 24 timer før. Aflyser du, refunderes gæsten altid fuldt ud." },
  { label: "GDPR.", text: "Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende til administration af overnatningerne." },
];

export function BookingActivationForm() {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [shelterName, setShelterName] = useState("");
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-3xl mb-3">✅</div>
        <h2 className="text-xl font-semibold text-green-800 mb-2">Tak for din tilmelding!</h2>
        <p className="text-green-700 text-sm">
          Vi gennemgår din forespørgsel og vender tilbage til dig på <strong>{email}</strong> inden for 2 hverdage.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) { setError("Du skal acceptere samarbejdsvilkårene"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/activate-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), organisation: organisation.trim(), email: email.trim(), shelterName: shelterName.trim(), message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt — prøv igen"); return; }
      setDone(true);
    } catch {
      setError("Netværksfejl — tjek din forbindelse og prøv igen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-primary/10 rounded-2xl p-8 space-y-5 bg-white shadow-sm">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary/80 mb-1.5">
            Dit navn <span className="text-red-500">*</span>
          </label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            required maxLength={200} placeholder="Christian Kaad"
            className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/80 mb-1.5">
            Organisation <span className="text-red-500">*</span>
          </label>
          <input
            type="text" value={organisation} onChange={(e) => setOrganisation(e.target.value)}
            required maxLength={200} placeholder="Geopark Odsherred"
            className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          required placeholder="du@organisation.dk"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">
          Shelterets navn på ShelterDK <span className="text-red-500">*</span>
        </label>
        <input
          type="text" value={shelterName} onChange={(e) => setShelterName(e.target.value)}
          required maxLength={200} placeholder="fx Skovhytten ved Esrum Sø"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">Evt. besked</label>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          maxLength={1000} rows={3} placeholder="Særlige ønsker eller spørgsmål?"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background resize-none"
        />
      </div>

      {/* Vilkår */}
      <div className="bg-background rounded-xl p-4 border border-primary/8">
        <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider mb-3">Samarbejdsvilkår</p>
        <div className="text-xs text-primary/50 leading-relaxed space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {VILKAR.map((v) => (
            <p key={v.label}>
              <strong className="text-primary/70">{v.label}</strong> {v.text}
            </p>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-primary/20 accent-[#C5A059]"
        />
        <span className="text-sm text-primary/70">
          Jeg accepterer <span className="underline text-primary font-medium">samarbejdsvilkårene</span> og bekræfter at oplysningerne er korrekte.
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit" disabled={submitting}
        className="w-full rounded-xl bg-accent text-white py-3 font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50 shadow"
      >
        {submitting ? "Sender..." : "Send tilmelding — vi kontakter dig inden 2 hverdage"}
      </button>
      <p className="text-center text-xs text-primary/30">Ingen kreditkort. Ingen binding. Gratis at bruge.</p>
      <p className="text-center text-xs text-primary/40">
        Spørgsmål?{" "}
        <a href="mailto:hej@shelterdk.dk" className="underline hover:text-primary/60">
          hej@shelterdk.dk
        </a>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep BookingActivationForm
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add web/components/BookingActivationForm.tsx
git commit -m "feat: BookingActivationForm client component"
```

---

## Task 5: `/aktiver-booking` page — landing + form

**Files:**
- Create: `web/app/(site)/aktiver-booking/page.tsx`

The page includes:
1. A hero/sales section (headline, bookingflow illustration, 6 benefit bullets, 3-step guide)
2. The `BookingActivationForm` component

All copy and visual elements match the approved mockup. Design tokens: `primary=#2C3E50`, `accent=#C5A059`, `background=#F9FAFB`, font DM Sans.

- [ ] **Step 1: Create page**

```typescript
// web/app/(site)/aktiver-booking/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BookingActivationForm } from "@/components/BookingActivationForm";

export const metadata: Metadata = {
  title: "Aktiver bookingsystem | ShelterDK",
  description:
    "Tilmeld dit shelter til ShelterDKs bookingsystem. Gratis for shelter-ejere — gæsterne booker online, du slipper for dobbeltbookinger og administration.",
  robots: "noindex",
};

const BENEFITS = [
  { icon: "🚫", title: "Ingen dobbeltbookinger", text: "Kalenderen opdateres i realtid. To gæster kan aldrig booke samme dato." },
  { icon: "📊", title: "Fuldt overblik", text: "Alle kommende bookinger ét sted. Hvem, hvornår og kontaktinfo — altid tilgængeligt." },
  { icon: "⚡", title: "Nul administration", text: "Gæsten booker selv. Du får en notifikation og behøver ikke foretage dig noget." },
  { icon: "📬", title: "Automatiske bekræftelser", text: "Gæsten får straks en bekræftelses-email. Du slipper for at svare på henvendelser." },
  { icon: "🗺️", title: "Mere synlighed", text: "Bookbare shelters fremhæves i søgeresultaterne på Danmarks største shelter-site." },
  { icon: "💸", title: "Gratis for dig som ejer", text: "Ingen oprettelsespris, ingen abonnement. Du betaler ingenting." },
];

const FLOW_STEPS = [
  { icon: "🧭", title: "Gæsten finder dit shelter", sub: "47.000 månedlige besøgende på ShelterDK" },
  { icon: "📅", title: "Gæsten vælger dato og booker", sub: "Kalender opdateres automatisk" },
  { icon: "📩", title: "Du modtager en bekræftelse", sub: "Navn, dato og kontaktinfo på gæsten" },
  { icon: "🏕️", title: "Gæsten ankommer — ingen overraskelser", sub: "Ingen dobbeltbookinger. Nogensinde.", highlight: true },
];

export default function AktiverBookingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-accent/20 px-4 py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-accent/30 text-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              ✦ Gratis for shelter-ejere
            </div>
            <h1 className="text-4xl font-bold leading-tight text-primary mb-4">
              Lad gæsterne booke<br />
              <span className="text-accent italic font-serif">dit shelter online</span>
            </h1>
            <p className="text-primary/60 text-lg mb-8 leading-relaxed">
              Slip for dobbeltbookinger og administration. Bookingsystemet håndterer alt automatisk — og det koster dig ingenting.
            </p>
            <a
              href="#tilmeld"
              className="inline-block bg-accent text-white font-bold px-6 py-3.5 rounded-xl hover:opacity-90 transition shadow-md"
            >
              Tilmeld dit shelter →
            </a>
          </div>

          {/* Flow diagram */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-primary/8">
              <p className="text-xs text-primary/40 uppercase tracking-wider font-semibold mb-4">Sådan virker det</p>
              <div className="space-y-3">
                {FLOW_STEPS.map((step, i) => (
                  <div key={i}>
                    <div className={`flex items-center gap-4 rounded-xl p-4 ${step.highlight ? "bg-accent/10 border border-accent/20" : "bg-background"}`}>
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
                        {step.icon}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${step.highlight ? "text-primary" : "text-primary"}`}>{step.title}</p>
                        <p className={`text-xs ${step.highlight ? "text-accent font-medium" : "text-primary/40"}`}>{step.sub}</p>
                      </div>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div className="flex justify-center text-accent font-bold py-0.5">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -top-3 -right-3 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-full shadow rotate-2">
              Helt gratis ✓
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-16 bg-white border-b border-primary/8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-primary mb-12">Hvad får du ud af det?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xl flex-shrink-0">{b.icon}</div>
                <div>
                  <h3 className="font-bold text-primary mb-1">{b.title}</h3>
                  <p className="text-primary/60 text-sm leading-relaxed">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-background border-b border-primary/8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-primary mb-2">Kom i gang på 5 minutter</h2>
          <p className="text-center text-primary/50 text-sm mb-10">Vi klarer resten. Du er klar til at modtage bookinger allerede i dag.</p>
          <div className="space-y-5">
            {[
              { n: 1, title: "Udfyld formularen herunder", sub: "Angiv navn, organisation og email. Under 2 minutter." },
              { n: 2, title: "Vi godkender og opsætter dit shelter", sub: "Vi kontakter dig inden for 1–2 hverdage og aktiverer bookingkalenderen." },
              { n: 3, title: "Gæsterne begynder at booke", sub: "Du modtager en email for hver booking — kalenderen holder styr på resten." },
            ].map((s) => (
              <div key={s.n} className="flex gap-5 items-start">
                <div className="flex-shrink-0 w-9 h-9 bg-accent text-white rounded-full flex items-center justify-center font-bold text-sm">{s.n}</div>
                <div className="pt-1">
                  <h3 className="font-bold text-primary mb-0.5">{s.title}</h3>
                  <p className="text-primary/50 text-sm">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="tilmeld" className="px-4 py-16 bg-white">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-primary mb-2">Tilmeld dit shelter</h2>
            <p className="text-primary/50 text-sm">Gratis. Ingen binding. Opsig med 1 måneds varsel.</p>
          </div>
          <BookingActivationForm />
        </div>
      </section>

      {/* Breadcrumb footer nav */}
      <footer className="border-t border-primary/8 px-4 py-6 bg-background">
        <nav className="max-w-5xl mx-auto text-xs text-primary/40 flex gap-2">
          <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
          <span>/</span>
          <span>Aktiver bookingsystem</span>
        </nav>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep aktiver-booking
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/app/\(site\)/aktiver-booking/page.tsx
git commit -m "feat: /aktiver-booking landing page with sales copy and form"
```

---

## Task 6: Section 5 — booking opt-in in `ShelterSubmissionForm`

**Files:**
- Modify: `web/components/ShelterSubmissionForm.tsx`

Add a collapsible section 5 between the photo/contact section and the submit button. When the user checks the toggle, the panel expands to show three mini benefit cards, the samarbejdsvilkår and an accept checkbox. The section uses an amber/accent colour scheme to stand out visually as a recommended option.

- [ ] **Step 1: Add `wantsBooking` state and booking section**

In `ShelterSubmissionForm.tsx`, after the existing state declarations, add:

```typescript
const [wantsBooking, setWantsBooking] = useState(false);
const [bookingAccepted, setBookingAccepted] = useState(false);
```

- [ ] **Step 2: Add validation in `handleSubmit`**

Inside `handleSubmit`, after the existing client-side validation and before the `fetch` call, add:

```typescript
if (wantsBooking && !bookingAccepted) {
  setSubmitError("Du skal acceptere samarbejdsvilkårene for bookingsystemet");
  return;
}
```

- [ ] **Step 3: Add `wants_booking` to the request body**

In the `fetch` body object inside `handleSubmit`, add:

```typescript
wants_booking: wantsBooking,
```

- [ ] **Step 4: Add section 5 JSX**

Add the following JSX directly before the submit button (after section 4's closing `</section>` tag):

```tsx
{/* Section 5: Booking opt-in */}
<section className="rounded-2xl border-2 border-accent/30 bg-accent/5 overflow-hidden">
  <label className="flex items-start gap-4 p-5 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={wantsBooking}
      onChange={(e) => { setWantsBooking(e.target.checked); if (!e.target.checked) setBookingAccepted(false); }}
      className="mt-0.5 w-5 h-5 rounded border-accent/40 accent-accent flex-shrink-0"
    />
    <div className="flex-1">
      <div className="flex items-center flex-wrap gap-2 mb-1">
        <span className="font-bold text-primary text-sm">5. Aktiver digitalt bookingsystem</span>
        <span className="bg-accent text-white text-xs font-semibold px-2 py-0.5 rounded-full">Anbefalet</span>
        <span className="text-xs text-accent font-semibold">Gratis</span>
      </div>
      <p className="text-sm text-primary/60">
        Lad gæsterne booke dit shelter direkte på ShelterDK — helt automatisk og uden administration for dig.
      </p>
    </div>
  </label>

  {wantsBooking && (
    <div className="border-t border-accent/20 px-5 pb-5 space-y-4">
      {/* Mini benefits */}
      <div className="grid grid-cols-3 gap-3 pt-4">
        {[
          { icon: "🚫", label: "Ingen dobbeltbookinger" },
          { icon: "📩", label: "Automatiske bekræftelser" },
          { icon: "📊", label: "Fuldt overblik" },
        ].map((b) => (
          <div key={b.label} className="bg-white rounded-xl p-3 text-center border border-accent/15">
            <div className="text-xl mb-1">{b.icon}</div>
            <p className="text-xs font-semibold text-primary">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Vilkår */}
      <div className="bg-white rounded-xl p-4 border border-primary/8">
        <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider mb-2">Samarbejdsvilkår</p>
        <div className="text-xs text-primary/50 leading-relaxed space-y-1.5 max-h-32 overflow-y-auto pr-1">
          <p><strong className="text-primary/70">Gratis for dig som ejer.</strong> Ingen oprettelsespris, abonnement eller skjulte omkostninger.</p>
          <p><strong className="text-primary/70">Ingen lejeopkrævning.</strong> Du stiller dit shelter gratis til rådighed og opkræver ingen leje.</p>
          <p><strong className="text-primary/70">Automatisk administration.</strong> ShelterDK håndterer al betaling og kommunikation med gæsten.</p>
          <p><strong className="text-primary/70">Afmelding.</strong> Begge parter kan til enhver tid opsige med 1 måneds varsel.</p>
          <p><strong className="text-primary/70">Servicegebyr.</strong> For at dække drift og administration opkræves et servicegebyr på 20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er ikke involveret i betalingstransaktionen.</p>
          <p><strong className="text-primary/70">Aflysninger.</strong> Gæsten kan aflyse gratis op til 24 timer før. Aflyser du, refunderes gæsten altid fuldt ud.</p>
          <p><strong className="text-primary/70">GDPR.</strong> Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende til administration af overnatningerne.</p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={bookingAccepted}
          onChange={(e) => setBookingAccepted(e.target.checked)}
          className="mt-0.5 rounded border-primary/20 accent-accent"
        />
        <span className="text-xs text-primary/60">
          Jeg accepterer{" "}
          <span className="underline text-primary/80 font-medium">samarbejdsvilkårene</span>{" "}
          for bookingsystemet.
        </span>
      </label>
    </div>
  )}
</section>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep ShelterSubmissionForm
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add web/components/ShelterSubmissionForm.tsx
git commit -m "feat: add booking opt-in section 5 to ShelterSubmissionForm"
```

---

## Task 7: Accept `wants_booking` in `submit-shelter` route

**Files:**
- Modify: `web/app/api/submit-shelter/route.ts`

- [ ] **Step 1: Add `wants_booking` parsing**

After the `photo_urls` validation block, add:

```typescript
const wants_booking = body.wants_booking === true;
```

- [ ] **Step 2: Include in the insert**

In the `supabase.from("shelter_submissions").insert({...})` call, add:

```typescript
wants_booking,
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep submit-shelter
```
Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
cd web && npx vitest run
```
Expected: all tests pass (≥384 — previous 376 + 8 new from Task 3 + 10 from Task 2 = 394).

- [ ] **Step 5: Commit**

```bash
git add web/app/api/submit-shelter/route.ts
git commit -m "feat: store wants_booking in shelter_submissions insert"
```

---

## Task 8: Show `wants_booking` badge in admin review panel

**Files:**
- Modify: `web/app/(site)/admin/shelter-ansogninger/page.tsx`

When a submission has `wants_booking: true`, show a small amber badge in the card header so the admin knows to activate booking after approval.

- [ ] **Step 1: Add badge to card header**

In the card header `<div>` that shows `sub.shelter_name` and `sub.location_text`, add after the existing photo count badge:

```tsx
{sub.wants_booking && (
  <span className="ml-2 inline-flex items-center gap-1 bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 text-accent text-xs font-semibold">
    📅 Ønsker booking
  </span>
)}
```

- [ ] **Step 2: Update `Submission` type**

The `Submission` type extends `ShelterSubmission` which now includes `wants_booking: boolean` — no changes needed if Task 1 is complete.

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep shelter-ansogninger
```
Expected: no output.

- [ ] **Step 4: Final test run**

```bash
cd web && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/app/\(site\)/admin/shelter-ansogninger/page.tsx
git commit -m "feat: show wants_booking badge in admin shelter review panel"
```

---

## Post-deploy checklist

- [ ] Run `web/migrations/20260514_shelter_submissions_wants_booking.sql` in Supabase SQL editor
- [ ] Visit `/aktiver-booking` — fill in form — confirm admin receives email at hej@shelterdk.dk and owner gets confirmation
- [ ] Visit `/opret-shelter` — check sektion 5 — enable toggle — fill vilkår checkbox — submit — confirm `wants_booking=true` in Supabase
- [ ] Open admin `/admin/shelter-ansogninger` — confirm "📅 Ønsker booking" badge appears on submissions with `wants_booking=true`
- [ ] Test validation: submit `/api/activate-booking` with missing fields → 400; with valid data → 201
