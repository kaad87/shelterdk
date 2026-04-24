# Shelter Booking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg et booking-system til private shelters — hosted på shelterdk.dk og som embeddbar iframe-widget — hvor gæster sender forespørgsler og ejere accepterer/afviser via email-links eller et token-beskyttet dashboard.

**Architecture:** Booking-siden lever på `/embed/book/[slug]` i det eksisterende embed-route-group (ingen navbar/footer). Owner-dashboardet er på `/owner/[token]` i (site)-layoutet. Alle API-routes bruger Supabase admin-klienten til writes. Emails sendes via det eksisterende `lib/email.ts`-pattern med Resend.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL, admin client), Resend (allerede installeret), react-day-picker (installeres nu), Vitest.

---

## Fil-struktur

**Nye filer:**
```
web/types/booking.ts                              — TypeScript-typer
web/lib/booking-db.ts                             — Supabase DB-helpers
web/lib/booking-email.ts                          — Email-funktioner til bookinger
web/app/embed/book/[slug]/page.tsx                — Bookingformular (iframe-venlig)
web/app/embed/book/[slug]/tak/page.tsx            — "Forespørgsel sendt"-side
web/app/booking/svar/[token]/page.tsx             — Accept/afvis-resultatside
web/app/(site)/owner/[token]/page.tsx             — Ejer-dashboard
web/app/api/book/[slug]/route.ts                  — POST opret booking
web/app/api/book/[slug]/availability/route.ts     — GET ledige datoer
web/app/api/booking/action/[token]/route.ts       — GET acceptér/afvis via email-link
web/app/api/owner/[token]/bookings/route.ts       — GET alle ejerens bookinger
web/app/api/owner/[token]/block/route.ts          — POST bloker/afbloker dato
web/app/api/owner/[token]/action/route.ts         — POST ejer acceptér/afvis fra dashboard
web/components/booking/BookingCalendar.tsx        — Kalender-komponent
web/components/booking/BookingForm.tsx            — Formular-komponent
web/components/owner/OwnerDashboard.tsx           — Dashboard-komponent
web/app/api/__tests__/booking.test.ts             — Vitest tests
```

**Ændrede filer:**
```
web/next.config.js                                — Tilføj iframe-header-override for /embed/
web/lib/email.ts                                  — Eksportér getResend + FROM_EMAIL som delte hjælpere
web/app/(site)/shelter/[slug]/page.tsx            — Tilføj "Book dette shelter"-knap
```

---

## Task 1: Setup — react-day-picker + next.config.js

**Files:**
- Modify: `web/package.json` (via npm install)
- Modify: `web/next.config.js`

- [ ] **Step 1: Installér react-day-picker**

```bash
cd /Users/CKA/shelterdk/web && npm install react-day-picker
```

- [ ] **Step 2: Tilføj iframe-header-override i next.config.js**

Find blokken der starter med `source: "/(.*)"` og tilføj en ny header-blok **før** den eksisterende `source: "/(.*)"` blok (ordre er vigtig — mere specifik rule skal stå først):

```javascript
// I nextConfig.headers() array, TILFØJ som FØRSTE element:
{
  source: "/embed/(.*)",
  headers: [
    { key: "X-Frame-Options", value: "ALLOWALL" },
    {
      key: "Content-Security-Policy",
      value: "frame-ancestors *",
    },
  ],
},
```

- [ ] **Step 3: Verificér at next.config.js stadig er valid**

```bash
cd /Users/CKA/shelterdk/web && node -e "require('./next.config.js'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add web/next.config.js web/package.json web/package-lock.json
git commit -m "feat(booking): install react-day-picker, allow iframe for /embed/book/"
```

---

## Task 2: Database migration — 4 nye tabeller

**Files:**
- Create: `web/supabase/migrations/20260424_booking_tables.sql`

- [ ] **Step 1: Opret migrations-fil**

```bash
mkdir -p /Users/CKA/shelterdk/web/supabase/migrations
```

Opret `web/supabase/migrations/20260424_booking_tables.sql` med dette indhold:

```sql
-- Bookable shelters (private shelters registered for booking on ShelterDK)
CREATE TABLE IF NOT EXISTS bookable_shelters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  shelter_id      uuid REFERENCES shelters(id) ON DELETE SET NULL,
  owner_email     text NOT NULL,
  owner_token     uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  max_persons     int NOT NULL DEFAULT 6,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Booking requests from guests
CREATE TABLE IF NOT EXISTS shelter_bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookable_shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  guest_name            text NOT NULL,
  guest_email           text NOT NULL,
  guest_count           int NOT NULL,
  check_in              date NOT NULL,
  check_out             date NOT NULL,
  message               text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','rejected','cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Single-use tokens for email accept/reject links
CREATE TABLE IF NOT EXISTS booking_action_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('confirm','reject')),
  token       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

-- Owner-blocked dates (e.g. "we are using it ourselves")
CREATE TABLE IF NOT EXISTS shelter_blocked_dates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookable_shelter_id   uuid NOT NULL REFERENCES bookable_shelters(id) ON DELETE CASCADE,
  blocked_date          date NOT NULL,
  reason                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bookable_shelter_id, blocked_date)
);

-- RLS: alle tabeller er public read, kun service_role må skrive
ALTER TABLE bookable_shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read bookable_shelters"
  ON bookable_shelters FOR SELECT USING (true);

CREATE POLICY "public read shelter_bookings"
  ON shelter_bookings FOR SELECT USING (true);

CREATE POLICY "public read shelter_blocked_dates"
  ON shelter_blocked_dates FOR SELECT USING (true);

-- booking_action_tokens: ingen public read (tokens er hemmelige)
-- Alle writes sker via service_role i API routes (bypasser RLS)

-- Index til availability-forespørgslen (hot path: hentes ved hvert kald til booking-siden)
CREATE INDEX IF NOT EXISTS idx_shelter_bookings_availability
  ON shelter_bookings (bookable_shelter_id, status, check_out);
```

- [ ] **Step 2: Kør SQL i Supabase Dashboard**

Åbn Supabase Dashboard → SQL Editor → Indsæt og kør hele filen.

Expected: 4 tabeller oprettes uden fejl.

- [ ] **Step 3: Verificér tabellerne eksisterer**

I Supabase Dashboard → Table Editor: bekræft at `bookable_shelters`, `shelter_bookings`, `booking_action_tokens`, `shelter_blocked_dates` vises.

- [ ] **Step 4: Commit SQL-filen**

```bash
git add web/supabase/migrations/20260424_booking_tables.sql
git commit -m "feat(booking): add SQL migration for 4 booking tables"
```

---

## Task 3: TypeScript-typer

**Files:**
- Create: `web/types/booking.ts`

- [ ] **Step 1: Opret `web/types/booking.ts`**

```typescript
export interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shelter_id: string | null;
  owner_email: string;
  owner_token: string;
  max_persons: number;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export interface ShelterBooking {
  id: string;
  bookable_shelter_id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string; // ISO date string "YYYY-MM-DD"
  check_out: string; // ISO date string "YYYY-MM-DD"
  message: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export type BookingAction = "confirm" | "reject";

export interface BookingActionToken {
  id: string;
  booking_id: string;
  action: BookingAction;
  token: string;
  expires_at: string;
  used_at: string | null;
}

export interface ShelterBlockedDate {
  id: string;
  bookable_shelter_id: string;
  blocked_date: string; // "YYYY-MM-DD"
  reason: string | null;
  created_at: string;
}

/** Response shape for GET /api/book/[slug]/availability */
export interface AvailabilityResponse {
  dates: Record<string, "pending" | "confirmed" | "blocked">;
}

/** Request body for POST /api/book/[slug] */
export interface CreateBookingBody {
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string; // "YYYY-MM-DD"
  check_out: string; // "YYYY-MM-DD"
  message?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/types/booking.ts
git commit -m "feat(booking): add TypeScript types for booking system"
```

---

## Task 4: `web/lib/booking-db.ts` — DB-helpers

**Files:**
- Create: `web/lib/booking-db.ts`

Disse funktioner bruges af alle API routes. De bruger `createAdminClient()` da de alle kræver write-adgang (service_role).

- [ ] **Step 1: Opret `web/lib/booking-db.ts`**

```typescript
import { createAdminClient } from "@/utils/supabase/server-admin";
import type {
  BookableShelter,
  ShelterBooking,
  BookingActionToken,
  BookingAction,
} from "@/types/booking";

// ─── Shelter lookup ──────────────────────────────────────────────────────────

export async function getBookableShelterBySlug(
  slug: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("slug", slug)
    .single();
  return data ?? null;
}

export async function getBookableShelterByOwnerToken(
  token: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("owner_token", token)
    .single();
  return data ?? null;
}

/** Find bookable shelter linked to a shelters.id (for detail page button) */
export async function getBookableShelterByShelterDbId(
  shelterId: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("shelter_id", shelterId)
    .single();
  return data ?? null;
}

// ─── Availability ────────────────────────────────────────────────────────────

/**
 * Returns all non-free dates for a shelter as a Record<isoDate, status>.
 * Only returns dates from today onwards (90 days window for performance).
 */
export async function getUnavailableDates(
  bookableShelterDbId: string
): Promise<Record<string, "pending" | "confirmed" | "blocked">> {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [bookingsResult, blockedResult] = await Promise.all([
    createAdminClient()
      .from("shelter_bookings")
      .select("check_in, check_out, status")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .in("status", ["pending", "confirmed"])
      .gte("check_out", today)
      .lte("check_in", until), // cap at 90-day window
    createAdminClient()
      .from("shelter_blocked_dates")
      .select("blocked_date")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .gte("blocked_date", today)
      .lte("blocked_date", until),
  ]);

  const result: Record<string, "pending" | "confirmed" | "blocked"> = {};

  // Expand booking date ranges into individual days
  for (const b of bookingsResult.data ?? []) {
    const start = new Date(b.check_in);
    const end = new Date(b.check_out);
    const cur = new Date(start);
    while (cur < end) {
      const iso = cur.toISOString().slice(0, 10);
      // confirmed beats pending
      if (result[iso] !== "confirmed") {
        result[iso] = b.status as "pending" | "confirmed";
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const d of blockedResult.data ?? []) {
    result[d.blocked_date] = "blocked";
  }

  return result;
}

// ─── Booking creation ────────────────────────────────────────────────────────

export async function createBooking(data: {
  bookable_shelter_id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  message: string | null;
}): Promise<ShelterBooking> {
  const { data: booking, error } = await createAdminClient()
    .from("shelter_bookings")
    .insert(data)
    .select()
    .single();
  if (error || !booking) throw new Error("Kunne ikke oprette booking: " + error?.message);
  return booking as ShelterBooking;
}

/** Creates two action tokens (confirm + reject) for a booking. Returns { confirmToken, rejectToken }. */
export async function createActionTokens(
  bookingId: string
): Promise<{ confirmToken: string; rejectToken: string }> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from("booking_action_tokens")
    .insert([
      { booking_id: bookingId, action: "confirm", expires_at: expiresAt },
      { booking_id: bookingId, action: "reject", expires_at: expiresAt },
    ])
    .select("action, token");
  if (error || !data) throw new Error("Kunne ikke oprette action tokens: " + error?.message);
  const confirmToken = data.find((r) => r.action === "confirm")!.token;
  const rejectToken = data.find((r) => r.action === "reject")!.token;
  return { confirmToken, rejectToken };
}

// ─── Action token resolution ─────────────────────────────────────────────────

export interface ActionTokenResult {
  token: BookingActionToken;
  booking: ShelterBooking;
  shelter: BookableShelter;
}

/**
 * Resolves an action token. Returns null if not found.
 * Does NOT check expiry or used_at — caller decides what to do.
 */
export async function resolveActionToken(
  token: string
): Promise<ActionTokenResult | null> {
  const { data: tokenRow } = await createAdminClient()
    .from("booking_action_tokens")
    .select("*")
    .eq("token", token)
    .single();
  if (!tokenRow) return null;

  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("id", tokenRow.booking_id)
    .single();
  if (!booking) return null;

  const { data: shelter } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", booking.bookable_shelter_id)
    .single();
  if (!shelter) return null;

  return {
    token: tokenRow as BookingActionToken,
    booking: booking as ShelterBooking,
    shelter: shelter as BookableShelter,
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await createAdminClient()
    .from("booking_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);
}

export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "rejected"
): Promise<void> {
  await createAdminClient()
    .from("shelter_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);
}

/**
 * Checks if accepting a booking would cause a conflict with an already-confirmed booking.
 * Returns true if there IS a conflict (should NOT accept).
 */
export async function hasConfirmedOverlap(
  bookableShelterDbId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string
): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("status", "confirmed")
    .neq("id", excludeBookingId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  return (data?.length ?? 0) > 0;
}

// ─── Owner dashboard ─────────────────────────────────────────────────────────

export async function getBookingsForShelter(
  bookableShelterDbId: string
): Promise<ShelterBooking[]> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .order("check_in", { ascending: true });
  return (data ?? []) as ShelterBooking[];
}

/** Lookup a single booking that belongs to a specific shelter (used in owner/action to avoid full scan). */
export async function getBookingByIdForShelter(
  bookingId: string,
  bookableShelterDbId: string
): Promise<ShelterBooking | null> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("bookable_shelter_id", bookableShelterDbId)
    .single();
  return data as ShelterBooking | null;
}

export async function blockDate(
  bookableShelterDbId: string,
  date: string,
  reason: string | null
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .upsert({ bookable_shelter_id: bookableShelterDbId, blocked_date: date, reason });
}

export async function unblockDate(
  bookableShelterDbId: string,
  date: string
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .delete()
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("blocked_date", date);
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/booking-db.ts
git commit -m "feat(booking): add booking-db helpers (shelter lookup, availability, CRUD)"
```

---

## Task 5: `web/lib/booking-email.ts` — Email-funktioner

**Files:**
- Modify: `web/lib/email.ts` (eksportér delte hjælpere)
- Create: `web/lib/booking-email.ts`

Booking-email-modulet genbruger `getResend()` og `FROM_EMAIL` fra det eksisterende `lib/email.ts` for at undgå duplikering. Spec siger eksplicit: "Brug `sendEmail()`-funktionen fra `lib/email.ts`."

- [ ] **Step 1: Eksportér delte hjælpere fra `web/lib/email.ts`**

Tilføj `export` foran `FROM_EMAIL` og `getResend` i `web/lib/email.ts`:

```typescript
// Skift (linje 4):
const FROM_EMAIL = "ShelterDK <onboarding@resend.dev>";
// Til:
export const FROM_EMAIL = "ShelterDK <onboarding@resend.dev>";

// Skift (linje 15):
function getResend() {
// Til:
export function getResend() {

// Skift (linje 6):
function escapeHtml(str: string): string {
// Til:
export function escapeHtml(str: string): string {
```

- [ ] **Step 2: Opret `web/lib/booking-email.ts`**

```typescript
import { getResend, FROM_EMAIL, escapeHtml } from "./email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function esc(s: string): string {
  return escapeHtml(s);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/** Til ejeren: ny bookingforespørgsel med accept/afvis-links */
export async function sendBookingRequestToOwner(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  message: string | null;
  confirmToken: string;
  rejectToken: string;
}) {
  const confirmUrl = `${SITE_URL}/api/booking/action/${opts.confirmToken}`;
  const rejectUrl = `${SITE_URL}/api/booking/action/${opts.rejectToken}`;
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny bookingforespørgsel</h2>
        <p><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) ønsker at booke <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;color:#666;">Datoer</td><td style="padding:8px;"><strong>${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</strong></td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Antal personer</td><td style="padding:8px;">${opts.guestCount}</td></tr>
          ${opts.message ? `<tr><td style="padding:8px;color:#666;">Besked</td><td style="padding:8px;">${esc(opts.message)}</td></tr>` : ""}
        </table>
        <div style="margin:24px 0;display:flex;gap:12px;">
          <a href="${confirmUrl}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✓ Acceptér booking</a>
          &nbsp;&nbsp;
          <a href="${rejectUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✗ Afvis booking</a>
        </div>
        <p style="color:#666;font-size:14px;">Eller administrér via dit <a href="${dashboardUrl}">dashboard</a>. Linkene udløber om 7 dage.</p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ejer forespørgsel): " + JSON.stringify(error));
}

/** Til gæsten: bekræftelse på at forespørgsel er modtaget */
export async function sendBookingReceivedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Vi har modtaget din forespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}!</h2>
        <p>Vi har modtaget din bookingforespørgsel til <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <p>Ejeren vender tilbage hurtigst muligt.</p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst modtaget): " + JSON.stringify(error));
}

/** Til gæsten: booking bekræftet */
export async function sendBookingConfirmedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking er bekræftet! 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#16a34a;">Din booking er bekræftet! 🎉</h2>
        <p>Hej ${esc(opts.guestName)}!</p>
        <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong> er bekræftet.</p>
        <p><strong>God tur!</strong></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst bekræftet): " + JSON.stringify(error));
}

/** Til gæsten: booking afvist */
export async function sendBookingRejectedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}</h2>
        <p>Desværre kunne ejeren ikke imødekomme din forespørgsel til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst afvist): " + JSON.stringify(error));
}
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/email.ts web/lib/booking-email.ts
git commit -m "feat(booking): export email helpers from lib/email.ts, add booking email functions"
```

---

## Task 6: GET `/api/book/[slug]/availability` + tests

**Files:**
- Create: `web/app/api/book/[slug]/availability/route.ts`
- Create: `web/app/api/__tests__/booking.test.ts`

- [ ] **Step 1: Opret `web/app/api/book/[slug]/availability/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterBySlug, getUnavailableDates } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }
  const dates = await getUnavailableDates(shelter.id);
  return NextResponse.json({ dates });
}
```

- [ ] **Step 2: Skriv test i `web/app/api/__tests__/booking.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGetBookableShelterBySlug = vi.fn();
const mockGetUnavailableDates = vi.fn();
const mockCreateBooking = vi.fn();
const mockCreateActionTokens = vi.fn();
const mockSendBookingRequestToOwner = vi.fn();
const mockSendBookingReceivedToGuest = vi.fn();
const mockResolveActionToken = vi.fn();
const mockMarkTokenUsed = vi.fn();
const mockUpdateBookingStatus = vi.fn();
const mockHasConfirmedOverlap = vi.fn();
const mockSendBookingConfirmedToGuest = vi.fn();
const mockSendBookingRejectedToGuest = vi.fn();

const mockGetBookableShelterByOwnerToken = vi.fn();
const mockGetBookingByIdForShelter = vi.fn();
const mockGetBookingsForShelter = vi.fn();
const mockBlockDate = vi.fn();
const mockUnblockDate = vi.fn();

vi.mock("@/lib/booking-db", () => ({
  getBookableShelterBySlug: mockGetBookableShelterBySlug,
  getUnavailableDates: mockGetUnavailableDates,
  createBooking: mockCreateBooking,
  createActionTokens: mockCreateActionTokens,
  resolveActionToken: mockResolveActionToken,
  markTokenUsed: mockMarkTokenUsed,
  updateBookingStatus: mockUpdateBookingStatus,
  hasConfirmedOverlap: mockHasConfirmedOverlap,
  getBookableShelterByOwnerToken: mockGetBookableShelterByOwnerToken,
  getBookingByIdForShelter: mockGetBookingByIdForShelter,
  getBookingsForShelter: mockGetBookingsForShelter,
  blockDate: mockBlockDate,
  unblockDate: mockUnblockDate,
}));

vi.mock("@/lib/booking-email", () => ({
  sendBookingRequestToOwner: mockSendBookingRequestToOwner,
  sendBookingReceivedToGuest: mockSendBookingReceivedToGuest,
  sendBookingConfirmedToGuest: mockSendBookingConfirmedToGuest,
  sendBookingRejectedToGuest: mockSendBookingRejectedToGuest,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockShelter(overrides = {}) {
  return {
    id: "shelter-uuid-1",
    slug: "test-shelter",
    title: "Test Shelter",
    owner_email: "ejer@test.dk",
    owner_token: "owner-token-1",
    max_persons: 6,
    ...overrides,
  };
}

function mockBooking(overrides = {}) {
  return {
    id: "booking-uuid-1",
    bookable_shelter_id: "shelter-uuid-1",
    guest_name: "Lars",
    guest_email: "lars@test.dk",
    guest_count: 2,
    check_in: "2026-06-01",
    check_out: "2026-06-03",
    message: null,
    status: "pending",
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
    ...overrides,
  };
}

// ── GET /api/book/[slug]/availability ─────────────────────────────────────────
describe("GET /api/book/[slug]/availability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 404 for ukendt slug", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(null);
    const { GET } = await import("../book/[slug]/availability/route");
    const res = await GET(
      new Request("http://localhost/api/book/ukendt/availability") as never,
      { params: Promise.resolve({ slug: "ukendt" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returnerer availability dates for kendt shelter", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    mockGetUnavailableDates.mockResolvedValue({
      "2026-06-01": "confirmed",
      "2026-06-10": "pending",
    });
    const { GET } = await import("../book/[slug]/availability/route");
    const res = await GET(
      new Request("http://localhost/api/book/test-shelter/availability") as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dates["2026-06-01"]).toBe("confirmed");
    expect(body.dates["2026-06-10"]).toBe("pending");
  });
});
```

- [ ] **Step 3: Kør tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/booking.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add web/app/api/book web/app/api/__tests__/booking.test.ts
git commit -m "feat(booking): add GET availability route + vitest tests"
```

---

## Task 7: POST `/api/book/[slug]` — opret booking

**Files:**
- Create: `web/app/api/book/[slug]/route.ts`
- Modify: `web/app/api/__tests__/booking.test.ts`

- [ ] **Step 1: Opret `web/app/api/book/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterBySlug,
  createBooking,
  createActionTokens,
} from "@/lib/booking-db";
import {
  sendBookingRequestToOwner,
  sendBookingReceivedToGuest,
} from "@/lib/booking-email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const guest_name = typeof b.guest_name === "string" ? b.guest_name.trim() : "";
  const guest_email = typeof b.guest_email === "string" ? b.guest_email.trim().toLowerCase() : "";
  const guest_count = typeof b.guest_count === "number" ? b.guest_count : 0;
  const check_in = typeof b.check_in === "string" ? b.check_in.trim() : "";
  const check_out = typeof b.check_out === "string" ? b.check_out.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 500) : null;

  // Validation
  if (!guest_name || guest_name.length > 100)
    return NextResponse.json({ error: "Ugyldigt navn (1–100 tegn)" }, { status: 400 });
  if (!EMAIL_RE.test(guest_email))
    return NextResponse.json({ error: "Ugyldig email" }, { status: 400 });
  if (!Number.isInteger(guest_count) || guest_count < 1 || guest_count > shelter.max_persons)
    return NextResponse.json(
      { error: `Antal skal være 1–${shelter.max_persons}` },
      { status: 400 }
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out))
    return NextResponse.json({ error: "Ugyldigt datoformat (YYYY-MM-DD)" }, { status: 400 });
  if (check_in >= check_out)
    return NextResponse.json({ error: "Afrejsedato skal være efter ankomstdato" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (check_in < today)
    return NextResponse.json({ error: "Ankomstdato kan ikke være i fortiden" }, { status: 400 });

  try {
    const booking = await createBooking({
      bookable_shelter_id: shelter.id,
      guest_name,
      guest_email,
      guest_count,
      check_in,
      check_out,
      message: message || null,
    });

    const { confirmToken, rejectToken } = await createActionTokens(booking.id);

    await Promise.all([
      sendBookingRequestToOwner({
        ownerEmail: shelter.owner_email,
        shelterTitle: shelter.title,
        ownerToken: shelter.owner_token,
        guestName: guest_name,
        guestEmail: guest_email,
        guestCount: guest_count,
        checkIn: check_in,
        checkOut: check_out,
        message: message || null,
        confirmToken,
        rejectToken,
      }),
      sendBookingReceivedToGuest({
        guestEmail: guest_email,
        guestName: guest_name,
        shelterTitle: shelter.title,
        checkIn: check_in,
        checkOut: check_out,
      }),
    ]);

    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 201 });
  } catch (err) {
    console.error("booking create error:", err);
    return NextResponse.json(
      { error: "Noget gik galt. Prøv igen." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Tilføj POST-tests i `booking.test.ts`**

Tilføj efter de eksisterende describe-blokke:

```typescript
// ── POST /api/book/[slug] ─────────────────────────────────────────────────────
describe("POST /api/book/[slug]", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    guest_name: "Lars",
    guest_email: "lars@test.dk",
    guest_count: 2,
    check_in: "2027-06-01",
    check_out: "2027-06-03",
  };

  it("returnerer 404 for ukendt shelter", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(null);
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/ukendt", {
        method: "POST", body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "ukendt" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returnerer 400 ved ugyldig email", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify({ ...validBody, guest_email: "ikke-en-email" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("email") });
  });

  it("returnerer 400 når check_out er før check_in", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify({ ...validBody, check_in: "2027-06-05", check_out: "2027-06-03" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(400);
  });

  it("opretter booking og returnerer 201 ved gyldigt input", async () => {
    mockGetBookableShelterBySlug.mockResolvedValue(mockShelter());
    mockCreateBooking.mockResolvedValue(mockBooking({ check_in: "2027-06-01", check_out: "2027-06-03" }));
    mockCreateActionTokens.mockResolvedValue({ confirmToken: "ct", rejectToken: "rt" });
    mockSendBookingRequestToOwner.mockResolvedValue(undefined);
    mockSendBookingReceivedToGuest.mockResolvedValue(undefined);
    const { POST } = await import("../book/[slug]/route");
    const res = await POST(
      new Request("http://localhost/api/book/test-shelter", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ slug: "test-shelter" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockCreateBooking).toHaveBeenCalledOnce();
    expect(mockSendBookingRequestToOwner).toHaveBeenCalledOnce();
    expect(mockSendBookingReceivedToGuest).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Kør tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/booking.test.ts
```

Expected: alle tests PASS (inkl. de fra Task 6)

- [ ] **Step 4: Commit**

```bash
git add web/app/api/book web/app/api/__tests__/booking.test.ts
git commit -m "feat(booking): add POST create-booking route + validation tests"
```

---

## Task 8: GET `/api/booking/action/[token]` — acceptér/afvis

**Files:**
- Create: `web/app/api/booking/action/[token]/route.ts`
- Modify: `web/app/api/__tests__/booking.test.ts`

- [ ] **Step 1: Opret `web/app/api/booking/action/[token]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  resolveActionToken,
  markTokenUsed,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import {
  sendBookingConfirmedToGuest,
  sendBookingRejectedToGuest,
} from "@/lib/booking-email";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveActionToken(token);

  if (!result) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=not_found`);
  }

  const { token: tokenRow, booking, shelter } = result;

  // Already used
  if (tokenRow.used_at) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_used`);
  }

  // Expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=expired`);
  }

  // Booking already resolved
  if (booking.status !== "pending") {
    return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=already_resolved`);
  }

  // Conflict check on confirm
  if (tokenRow.action === "confirm") {
    const conflict = await hasConfirmedOverlap(
      booking.bookable_shelter_id,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (conflict) {
      return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=conflict`);
    }
  }

  // Mark token used + update booking
  await markTokenUsed(tokenRow.id);
  const newStatus = tokenRow.action === "confirm" ? "confirmed" : "rejected";
  await updateBookingStatus(booking.id, newStatus);

  // Send email to guest
  try {
    if (newStatus === "confirmed") {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
      });
    } else {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email,
        guestName: booking.guest_name,
        shelterTitle: shelter.title,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
      });
    }
  } catch (err) {
    console.error("action email error:", err);
    // Don't fail the action if email fails
  }

  return NextResponse.redirect(`${SITE_URL}/booking/svar/${token}?status=${newStatus}`);
}
```

- [ ] **Step 2: Tilføj action-token tests i `booking.test.ts`**

```typescript
// ── GET /api/booking/action/[token] ──────────────────────────────────────────
describe("GET /api/booking/action/[token]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirecter til not_found for ukendt token", async () => {
    mockResolveActionToken.mockResolvedValue(null);
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("not_found");
  });

  it("redirecter til already_used for brugt token", async () => {
    mockResolveActionToken.mockResolvedValue({
      token: { id: "t1", action: "confirm", used_at: "2026-04-24T00:00:00Z", expires_at: "2026-05-01T00:00:00Z" },
      booking: mockBooking({ status: "pending" }),
      shelter: mockShelter(),
    });
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "brugt" }) }
    );
    expect(res.headers.get("location")).toContain("already_used");
  });

  it("bekræfter booking og redirecter til confirmed", async () => {
    mockResolveActionToken.mockResolvedValue({
      token: { id: "t1", action: "confirm", used_at: null, expires_at: "2099-01-01T00:00:00Z" },
      booking: mockBooking({ status: "pending" }),
      shelter: mockShelter(),
    });
    mockHasConfirmedOverlap.mockResolvedValue(false);
    mockMarkTokenUsed.mockResolvedValue(undefined);
    mockUpdateBookingStatus.mockResolvedValue(undefined);
    mockSendBookingConfirmedToGuest.mockResolvedValue(undefined);
    const { GET } = await import("../booking/action/[token]/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "confirm-token" }) }
    );
    expect(res.headers.get("location")).toContain("confirmed");
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("booking-uuid-1", "confirmed");
  });
});
```

- [ ] **Step 3: Kør tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/booking.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add web/app/api/booking web/app/api/__tests__/booking.test.ts
git commit -m "feat(booking): add action token route (confirm/reject via email link) + tests"
```

---

## Task 9: Owner API routes

**Files:**
- Create: `web/app/api/owner/[token]/bookings/route.ts`
- Create: `web/app/api/owner/[token]/block/route.ts`
- Create: `web/app/api/owner/[token]/action/route.ts`

- [ ] **Step 1: Opret `web/app/api/owner/[token]/bookings/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, getBookingsForShelter } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  const bookings = await getBookingsForShelter(shelter.id);
  return NextResponse.json({ bookings, shelter });
}
```

- [ ] **Step 2: Opret `web/app/api/owner/[token]/block/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, blockDate, unblockDate } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date: string = body.date ?? "";
  const unblock: boolean = body.unblock === true;
  const reason: string | null = body.reason ?? null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Ugyldig dato" }, { status: 400 });

  if (unblock) {
    await unblockDate(shelter.id, date);
  } else {
    await blockDate(shelter.id, date, reason);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Opret `web/app/api/owner/[token]/action/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingByIdForShelter,
  updateBookingStatus,
  hasConfirmedOverlap,
} from "@/lib/booking-db";
import { sendBookingConfirmedToGuest, sendBookingRejectedToGuest } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bookingId: string = body.booking_id ?? "";
  const action: string = body.action ?? "";

  if (!bookingId || (action !== "confirm" && action !== "reject"))
    return NextResponse.json({ error: "Ugyldige parametre" }, { status: 400 });

  // Verify booking belongs to this shelter (direct lookup — no full scan)
  const booking = await getBookingByIdForShelter(bookingId, shelter.id);
  if (!booking) return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  if (booking.status !== "pending")
    return NextResponse.json({ error: "Booking er allerede behandlet" }, { status: 409 });

  if (action === "confirm") {
    const conflict = await hasConfirmedOverlap(
      shelter.id, booking.check_in, booking.check_out, bookingId
    );
    if (conflict)
      return NextResponse.json(
        { error: "En anden bekræftet booking overlapper disse datoer" },
        { status: 409 }
      );
  }

  await updateBookingStatus(bookingId, action === "confirm" ? "confirmed" : "rejected");

  try {
    if (action === "confirm") {
      await sendBookingConfirmedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    } else {
      await sendBookingRejectedToGuest({
        guestEmail: booking.guest_email, guestName: booking.guest_name,
        shelterTitle: shelter.title, checkIn: booking.check_in, checkOut: booking.check_out,
      });
    }
  } catch (err) {
    console.error("owner action email error:", err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Tilføj tests for owner-routes i `booking.test.ts`**

Tilføj disse describe-blokke i slutningen af filen (mocks er allerede defineret øverst i filen fra Task 6):

```typescript
// ── GET /api/owner/[token]/bookings ───────────────────────────────────────────
describe("GET /api/owner/[token]/bookings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { GET } = await import("../owner/[token]/bookings/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returnerer bookings for gyldigt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingsForShelter.mockResolvedValue([mockBooking()]);
    const { GET } = await import("../owner/[token]/bookings/route");
    const res = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings).toHaveLength(1);
  });
});

// ── POST /api/owner/[token]/block ─────────────────────────────────────────────
describe("POST /api/owner/[token]/block", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/block/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ date: "2026-06-01" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("blokerer en dato og returnerer ok", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockBlockDate.mockResolvedValue(undefined);
    const { POST } = await import("../owner/[token]/block/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ date: "2026-06-01" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockBlockDate).toHaveBeenCalledWith("shelter-uuid-1", "2026-06-01", null);
  });
});

// ── POST /api/owner/[token]/action ────────────────────────────────────────────
describe("POST /api/owner/[token]/action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returnerer 401 for ukendt token", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "b1", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "ukendt" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returnerer 404 for booking der ikke tilhører shelteret", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingByIdForShelter.mockResolvedValue(null);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "fremmed-booking", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("bekræfter booking og returnerer ok", async () => {
    mockGetBookableShelterByOwnerToken.mockResolvedValue(mockShelter());
    mockGetBookingByIdForShelter.mockResolvedValue(mockBooking({ status: "pending" }));
    mockHasConfirmedOverlap.mockResolvedValue(false);
    mockUpdateBookingStatus.mockResolvedValue(undefined);
    mockSendBookingConfirmedToGuest.mockResolvedValue(undefined);
    const { POST } = await import("../owner/[token]/action/route");
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ booking_id: "booking-uuid-1", action: "confirm" }), headers: { "Content-Type": "application/json" } }) as never,
      { params: Promise.resolve({ token: "owner-token-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("booking-uuid-1", "confirmed");
  });
});
```

- [ ] **Step 5: Kør alle booking tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run app/api/__tests__/booking.test.ts
```

Expected: alle tests PASS (inkl. de fra Task 6, 7, 8)

- [ ] **Step 6: Commit**

```bash
git add web/app/api/owner web/app/api/__tests__/booking.test.ts
git commit -m "feat(booking): add owner API routes (bookings, block, action) + tests"
```

---

## Task 10: `BookingCalendar` + `BookingForm` komponenter

**Files:**
- Create: `web/components/booking/BookingCalendar.tsx`
- Create: `web/components/booking/BookingForm.tsx`

- [ ] **Step 1: Opret `web/components/booking/BookingCalendar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

interface BookingCalendarProps {
  unavailableDates: Record<string, "pending" | "confirmed" | "blocked">;
  onRangeSelect: (range: { checkIn: string; checkOut: string } | null) => void;
  maxPersons: number;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isUnavailable(
  date: Date,
  unavailable: Record<string, "pending" | "confirmed" | "blocked">
): boolean {
  const iso = toIso(date);
  return !!unavailable[iso];
}

export function BookingCalendar({
  unavailableDates,
  onRangeSelect,
}: BookingCalendarProps) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSelect = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to) {
      onRangeSelect({ checkIn: toIso(r.from), checkOut: toIso(r.to) });
    } else {
      onRangeSelect(null);
    }
  };

  const modifiers = {
    confirmed: (d: Date) => unavailableDates[toIso(d)] === "confirmed",
    pending: (d: Date) => unavailableDates[toIso(d)] === "pending",
    blocked: (d: Date) => unavailableDates[toIso(d)] === "blocked",
  };

  const modifiersStyles = {
    confirmed: { backgroundColor: "#fecaca", color: "#991b1b", borderRadius: "50%" },
    pending: { backgroundColor: "#fef08a", color: "#854d0e", borderRadius: "50%" },
    blocked: { backgroundColor: "#e5e7eb", color: "#9ca3af", borderRadius: "50%" },
  };

  return (
    <div>
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        disabled={(d) => d < today || isUnavailable(d, unavailableDates)}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        numberOfMonths={1}
      />
      <div className="flex gap-3 text-xs mt-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Ledig
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" /> Afventer
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Optaget
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Opret `web/components/booking/BookingForm.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookingCalendar } from "./BookingCalendar";
import type { AvailabilityResponse } from "@/types/booking";

interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
}

export function BookingForm({ shelterSlug, shelterTitle, maxPersons }: BookingFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, "pending" | "confirmed" | "blocked">>({});
  const [dateRange, setDateRange] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_count: 1, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${shelterSlug}/availability`)
      .then((r) => r.json())
      .then((data: AvailabilityResponse) => setAvailability(data.dates ?? {}))
      .catch(() => {});
  }, [shelterSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange) { setError("Vælg ankomst- og afrejsedato"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/book/${shelterSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...dateRange }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      // Navigate to tak-page (spec: "Bruger lander på /embed/book/[slug]/tak")
      router.push(`/embed/book/${shelterSlug}/tak`);
    } catch {
      setError("Noget gik galt. Tjek din forbindelse og prøv igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold text-primary">Book {shelterTitle}</h1>

      <BookingCalendar
        unavailableDates={availability}
        onRangeSelect={setDateRange}
        maxPersons={maxPersons}
      />

      {dateRange && (
        <p className="text-sm text-primary/70 bg-primary/5 rounded-lg px-3 py-2">
          Valgt: <strong>{dateRange.checkIn}</strong> → <strong>{dateRange.checkOut}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Navn *</label>
          <input
            type="text" required maxLength={100}
            value={form.guest_name}
            onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Email *</label>
          <input
            type="email" required
            value={form.guest_email}
            onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Antal personer * (maks {maxPersons})
          </label>
          <input
            type="number" required min={1} max={maxPersons}
            value={form.guest_count}
            onChange={(e) => setForm((f) => ({ ...f, guest_count: Number(e.target.value) }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Besked til ejer (valgfri)</label>
          <textarea
            maxLength={500} rows={3}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit" disabled={submitting || !dateRange}
          className="w-full rounded-lg bg-accent text-white font-semibold py-3 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Sender…" : "Send bookingforespørgsel"}
        </button>
      </form>

      <p className="text-xs text-primary/40 text-center">
        Leveret af{" "}
        <a href="https://shelterdk.dk" target="_blank" rel="noopener" className="underline">
          ShelterDK
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/booking
git commit -m "feat(booking): add BookingCalendar and BookingForm components"
```

---

## Task 11: Booking-sider (`/embed/book/[slug]`, tak-side, svar-side)

**Files:**
- Create: `web/app/embed/book/[slug]/page.tsx`
- Create: `web/app/embed/book/[slug]/tak/page.tsx`
- Create: `web/app/booking/svar/[token]/page.tsx`

- [ ] **Step 1: Opret `web/app/embed/book/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getBookableShelterBySlug } from "@/lib/booking-db";
import { BookingForm } from "@/components/booking/BookingForm";

interface Props { params: Promise<{ slug: string }> }

export default async function EmbedBookPage({ params }: Props) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) notFound();

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        <BookingForm
          shelterSlug={shelter.slug}
          shelterTitle={shelter.title}
          maxPersons={shelter.max_persons}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Opret `web/app/embed/book/[slug]/tak/page.tsx`**

```tsx
export default function TakPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="font-serif text-2xl font-bold text-primary mb-2">
          Forespørgsel sendt!
        </h1>
        <p className="text-primary/70 leading-relaxed">
          Ejeren vender tilbage hurtigst muligt. Du modtager en email-bekræftelse.
        </p>
        <p className="mt-6 text-xs text-primary/40">
          Leveret af{" "}
          <a
            href="https://shelterdk.dk"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            ShelterDK
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Opret `web/app/booking/svar/[token]/page.tsx`**

```tsx
import Link from "next/link";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const messages: Record<string, { emoji: string; title: string; body: string }> = {
  confirmed: {
    emoji: "✓",
    title: "Booking bekræftet",
    body: "Du har bekræftet bookingen. Gæsten modtager en bekræftelsesemail.",
  },
  rejected: {
    emoji: "✗",
    title: "Booking afvist",
    body: "Du har afvist bookingen. Gæsten er notificeret.",
  },
  already_used: {
    emoji: "ℹ️",
    title: "Allerede behandlet",
    body: "Denne booking er allerede behandlet.",
  },
  expired: {
    emoji: "⏱",
    title: "Link udløbet",
    body: "Dette link er udløbet (7 dage). Gå til dit dashboard for at behandle bookingen.",
  },
  conflict: {
    emoji: "⚠️",
    title: "Dato-konflikt",
    body: "En anden bekræftet booking overlapper disse datoer. Gå til dit dashboard og afvis den ene.",
  },
  already_resolved: {
    emoji: "ℹ️",
    title: "Allerede behandlet",
    body: "Denne booking er allerede bekræftet eller afvist.",
  },
  not_found: {
    emoji: "✗",
    title: "Link ikke fundet",
    body: "Dette link er ugyldigt eller er allerede blevet brugt.",
  },
};

export default async function BookingSvarPage({ searchParams }: Props) {
  const { status = "not_found" } = await searchParams;
  const msg = messages[status] ?? messages.not_found;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm bg-white rounded-2xl border border-primary/10 shadow-sm p-8">
        <div className="text-5xl mb-4">{msg.emoji}</div>
        <h1 className="font-serif text-2xl font-bold text-primary mb-3">{msg.title}</h1>
        <p className="text-primary/70 leading-relaxed mb-6">{msg.body}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web/app/embed/book web/app/booking
git commit -m "feat(booking): add embed booking page, tak-side, and action result page"
```

---

## Task 12: Owner dashboard (`/owner/[token]`)

**Files:**
- Create: `web/components/owner/OwnerDashboard.tsx`
- Create: `web/app/(site)/owner/[token]/page.tsx`

- [ ] **Step 1: Opret `web/components/owner/OwnerDashboard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

const STATUS_LABELS: Record<string, string> = {
  pending: "Afventer",
  confirmed: "Bekræftet",
  rejected: "Afvist",
  cancelled: "Annulleret",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
  cancelled: "bg-gray-50 text-gray-600 border-gray-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  shelter: BookableShelter;
  initialBookings: ShelterBooking[];
  ownerToken: string;
}

export function OwnerDashboard({ shelter, initialBookings, ownerToken }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockDate, setBlockDate] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe\n  src="https://shelterdk.dk/embed/book/${shelter.slug}"\n  width="100%"\n  height="620"\n  frameborder="0"\n  style="border-radius:8px;border:1px solid #e5e7eb;"\n  title="Book ${shelter.title}"\n></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;">\n  <a href="https://shelterdk.dk" target="_blank" rel="noopener">Leveret af ShelterDK</a>\n</p>`;

  const handleAction = async (bookingId: string, action: "confirm" | "reject") => {
    setActionError(null);
    const res = await fetch(`/api/owner/${ownerToken}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action }),
    });
    const data = await res.json();
    if (!res.ok) { setActionError(data.error ?? "Fejl"); return; }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: action === "confirm" ? "confirmed" : "rejected" }
          : b
      )
    );
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg(null);
    const res = await fetch(`/api/owner/${ownerToken}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: blockDate }),
    });
    if (res.ok) { setBlockMsg("Dato blokeret: " + blockDate); setBlockDate(""); }
    else setBlockMsg("Fejl — prøv igen");
  };

  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.check_in >= new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary mb-1">{shelter.title}</h1>
        <p className="text-primary/60 text-sm">Ejer-dashboard · {shelter.owner_email}</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Afventer svar ({pending.length})
          </h2>
          {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}
          <div className="space-y-3">
            {pending.map((b) => (
              <div key={b.id} className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-primary">{b.guest_name}</p>
                    <p className="text-sm text-primary/60">{b.guest_email} · {b.guest_count} pers.</p>
                    <p className="text-sm font-medium text-primary mt-1">
                      {formatDate(b.check_in)} → {formatDate(b.check_out)}
                    </p>
                    {b.message && <p className="text-sm text-primary/70 mt-1 italic">"{b.message}"</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(b.id, "confirm")}
                      className="rounded-lg bg-green-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-green-700 transition-colors"
                    >
                      Acceptér
                    </button>
                    <button
                      onClick={() => handleAction(b.id, "reject")}
                      className="rounded-lg border border-red-300 text-red-700 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 transition-colors"
                    >
                      Afvis
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming confirmed */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">
          Kommende bookinger ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-primary/50 text-sm">Ingen kommende bekræftede bookinger.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="rounded-xl border border-primary/10 bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">{b.guest_name}</p>
                  <p className="text-sm text-primary/60">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_count} pers.</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Block a date */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">Bloker dato</h2>
        <form onSubmit={handleBlock} className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Dato</label>
            <input
              type="date" required value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              className="rounded-lg border border-primary/20 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
            Bloker
          </button>
        </form>
        {blockMsg && <p className="text-sm text-primary/70 mt-2">{blockMsg}</p>}
      </section>

      {/* Embed code */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">Embed-kode til din hjemmeside</h2>
        <div className="relative">
          <pre className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-xs overflow-x-auto text-primary/80 whitespace-pre-wrap">
            {embedCode}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute top-3 right-3 rounded-lg bg-white border border-primary/15 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            {copied ? "Kopieret!" : "Kopiér"}
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Opret `web/app/(site)/owner/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookableShelterByOwnerToken, getBookingsForShelter } from "@/lib/booking-db";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

interface Props { params: Promise<{ token: string }> }

export const metadata: Metadata = {
  title: { absolute: "Ejer-dashboard | ShelterDK" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: Props) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) notFound();

  const bookings = await getBookingsForShelter(shelter.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <OwnerDashboard
          shelter={shelter}
          initialBookings={bookings}
          ownerToken={token}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/owner web/app/\(site\)/owner
git commit -m "feat(booking): add owner dashboard component and page"
```

---

## Task 13: "Book dette shelter"-knap på shelter-detailside

**Files:**
- Modify: `web/app/(site)/shelter/[slug]/page.tsx`

Filen er læst og kortlagt. Shelter-data er i `shelter`-variablen fra linje 137. `<ShelterDetailContent>` renderes fra linje 232. Tilføj import, async lookup og JSX som vist nedenfor — ingen guess-work nødvendigt.

- [ ] **Step 1: Tilføj import til `booking-db` i toppen af filen**

Find linjen (linje 36):
```typescript
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
```

Tilføj **efter** den linje:
```typescript
import { getBookableShelterByShelterDbId } from "@/lib/booking-db";
```

- [ ] **Step 2: Tilføj async lookup efter shelter+reviews er hentet**

Find linjen (linje 150-153):
```typescript
  const [reviews, area] = await Promise.all([
    getReviews(shelter.google_place_id ?? null),
    areaSlug ? getAreaBySlug(areaSlug) : Promise.resolve(null),
  ]);
```

Tilføj **efter** den blok:
```typescript
  // Tjek om dette shelter har en bookbar side på ShelterDK
  const bookableShelter = await getBookableShelterByShelterDbId(shelter.id).catch(() => null);
```

- [ ] **Step 3: Tilføj booking-knap i JSX**

Find linjen (linje 228):
```typescript
  return (
    <>
      <ShelterSchema shelter={shelter} canonicalPath={`/shelter/${slug}`} reviews={reviews} />
      <BreadcrumbSchema items={breadcrumbSchemaItems} />
      <ShelterDetailContent
```

Tilføj **mellem** `<BreadcrumbSchema .../>` og `<ShelterDetailContent`:
```tsx
      {bookableShelter && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-primary">
              Book dette shelter direkte på ShelterDK
            </p>
            <a
              href={`/embed/book/${bookableShelter.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              Book nu →
            </a>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Kør alle tests**

```bash
cd /Users/CKA/shelterdk/web && npx vitest run
```

Expected: alle eksisterende + nye tests PASS

- [ ] **Step 5: Commit og push**

```bash
git add web/app/\(site\)/shelter/\[slug\]/page.tsx
git commit -m "feat(booking): add 'Book dette shelter' button on shelter detail page"
git push
```

---

## Verifikation efter deploy

1. Opret test-shelter i Supabase: `INSERT INTO bookable_shelters (slug, title, owner_email, max_persons) VALUES ('test-shelter', 'Test Hytten', 'din@email.dk', 4);`
2. Besøg `https://shelterdk.dk/embed/book/test-shelter` — kalender og formular vises
3. Send en testforespørgsel — du modtager email med accept/afvis-links
4. Klik accept-link — bekræftelsesside vises, gæst-email sendes
5. Besøg `/owner/[din-owner-token]` — booking vises i dashboardet
6. Embed koden i en blank HTML-side og åbn i browser — iframe virker
7. Tjek at `/embed/book/ukendt-slug` returnerer 404
