# iCal Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add iCal export (owners subscribe to a live `.ics` feed) and import (auto-sync blocked dates from ONE.com/Airbnb/Google Calendar hourly) to the ShelterDK booking system.

**Architecture:** Pure lib functions for parsing/generation (fully testable), thin API route handlers that delegate to lib, a Netlify Scheduled Function that calls the cron endpoint hourly. Import uses full-sync semantics keyed on `source='ical_sync'` so manually blocked dates are never touched.

**Tech Stack:** Next.js 14 App Router, Supabase (via `createAdminClient`), Vitest, Netlify Scheduled Functions (`@netlify/functions`), no external iCal packages.

**Working directory for all commands:** `web/` inside the repo worktree.

---

### Task 1: Update types

**Files:**
- Modify: `web/types/booking.ts`

- [ ] **Step 1: Add new fields to `BookableShelter` and `ShelterBlockedDate`**

Open `web/types/booking.ts`. Make these two changes:

```ts
// BookableShelter — add after `booking_mode`:
  ical_import_url:     string | null;
  ical_last_synced_at: string | null;

// ShelterBlockedDate — add after `reason`:
  source: 'manual' | 'ical_sync';
```

Full updated file:

```ts
export interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shelter_id: string | null;
  owner_email: string;
  owner_token: string;
  max_persons: number;
  booking_mode: "shelterdk" | "iframe";
  ical_import_url: string | null;
  ical_last_synced_at: string | null;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export interface ShelterBooking {
  id: string;
  bookable_shelter_id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string;
  check_out: string;
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
  blocked_date: string;
  reason: string | null;
  source: "manual" | "ical_sync";
  created_at: string;
}

export interface AvailabilityResponse {
  dates: Record<string, "pending" | "confirmed" | "blocked">;
}

export interface CreateBookingBody {
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  message?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -20
```

Expected: no output (no errors in our files).

- [ ] **Step 3: Commit**

```bash
git add web/types/booking.ts
git commit -m "feat(ical): update types — BookableShelter + ShelterBlockedDate"
```

---

### Task 2: Create `lib/ical-parser.ts` with tests

**Files:**
- Create: `web/lib/ical-parser.ts`
- Create: `web/lib/__tests__/ical-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/ical-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { unfoldIcal, parseIcal } from "@/lib/ical-parser";

// ── unfoldIcal ──────────────────────────────────────────────────────────────

describe("unfoldIcal", () => {
  it("joins lines folded with CRLF + space", () => {
    const raw = "SUMMARY:Hello\r\n World";
    expect(unfoldIcal(raw)).toBe("SUMMARY:Hello World");
  });

  it("joins lines folded with CRLF + tab", () => {
    const raw = "DTSTART:2026060\r\n 1";
    expect(unfoldIcal(raw)).toBe("DTSTART:20260601");
  });

  it("converts remaining CRLF to LF", () => {
    const raw = "A:1\r\nB:2";
    expect(unfoldIcal(raw)).toBe("A:1\nB:2");
  });
});

// ── parseIcal ───────────────────────────────────────────────────────────────

const wrap = (inner: string) =>
  `BEGIN:VCALENDAR\nVERSION:2.0\n${inner}\nEND:VCALENDAR`;

const vevent = (dtstart: string, dtend: string, extra = "") =>
  `BEGIN:VEVENT\nDTSTART${dtstart}\nDTEND${dtend}\nUID:test@shelterdk.dk\n${extra}END:VEVENT`;

describe("parseIcal", () => {
  it("returns [] for empty string", () => {
    expect(parseIcal("")).toEqual([]);
  });

  it("returns [] if BEGIN:VCALENDAR is missing", () => {
    expect(parseIcal("BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260601\nEND:VEVENT")).toEqual([]);
  });

  it("parses all-day DATE event", () => {
    const raw = wrap(vevent(";VALUE=DATE:20260601", ";VALUE=DATE:20260603"));
    expect(parseIcal(raw)).toEqual([{ start: "2026-06-01", end: "2026-06-03" }]);
  });

  it("parses UTC DATE-TIME event (extracts date only)", () => {
    const raw = wrap(vevent(":20260601T140000Z", ":20260603T140000Z"));
    expect(parseIcal(raw)).toEqual([{ start: "2026-06-01", end: "2026-06-03" }]);
  });

  it("parses TZID DATE-TIME event (extracts date only, ignores tz)", () => {
    const raw = wrap(vevent(";TZID=Europe/Copenhagen:20260601T140000", ";TZID=Europe/Copenhagen:20260603T140000"));
    expect(parseIcal(raw)).toEqual([{ start: "2026-06-01", end: "2026-06-03" }]);
  });

  it("skips CANCELLED events", () => {
    const raw = wrap(vevent(";VALUE=DATE:20260601", ";VALUE=DATE:20260603", "STATUS:CANCELLED\n"));
    expect(parseIcal(raw)).toEqual([]);
  });

  it("skips events spanning more than 365 days", () => {
    const raw = wrap(vevent(";VALUE=DATE:20260101", ";VALUE=DATE:20280101"));
    expect(parseIcal(raw)).toEqual([]);
  });

  it("handles VALARM inside VEVENT without breaking parse", () => {
    const raw = wrap(
      `BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260601\nDTEND;VALUE=DATE:20260602\nUID:a@b\nBEGIN:VALARM\nTRIGGER:-PT15M\nEND:VALARM\nEND:VEVENT`
    );
    expect(parseIcal(raw)).toEqual([{ start: "2026-06-01", end: "2026-06-02" }]);
  });

  it("parses multiple events", () => {
    const raw = wrap(
      vevent(";VALUE=DATE:20260601", ";VALUE=DATE:20260603") + "\n" +
      vevent(";VALUE=DATE:20260701", ";VALUE=DATE:20260705")
    );
    expect(parseIcal(raw)).toEqual([
      { start: "2026-06-01", end: "2026-06-03" },
      { start: "2026-07-01", end: "2026-07-05" },
    ]);
  });

  it("handles line-folded DTSTART correctly", () => {
    const raw = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DAT\r\n E:20260601\nDTEND;VALUE=DATE:20260602\nUID:x\nEND:VEVENT\nEND:VCALENDAR`;
    expect(parseIcal(raw)).toEqual([{ start: "2026-06-01", end: "2026-06-02" }]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/ical-parser.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module '@/lib/ical-parser'`

- [ ] **Step 3: Create `web/lib/ical-parser.ts`**

```ts
export interface IcalEvent {
  start: string; // "YYYY-MM-DD"
  end: string;   // "YYYY-MM-DD"
}

/** RFC 5545 §3.1 — unfold continuation lines before any parsing. */
export function unfoldIcal(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n");
}

/**
 * Extract a YYYY-MM-DD string from a DTSTART/DTEND property value.
 * Handles:
 *   ;VALUE=DATE:20260601
 *   :20260601T140000Z
 *   ;TZID=Europe/Copenhagen:20260601T140000
 */
function extractDate(line: string): string | null {
  // Value is everything after the last colon
  const colonIdx = line.lastIndexOf(":");
  if (colonIdx === -1) return null;
  const value = line.slice(colonIdx + 1).trim();
  // Must start with 8 digits
  if (!/^\d{8}/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/** Parse raw iCal text into an array of date range events. */
export function parseIcal(raw: string): IcalEvent[] {
  const text = unfoldIcal(raw);

  if (!text.includes("BEGIN:VCALENDAR")) return [];

  const events: IcalEvent[] = [];

  // Split on VEVENT boundaries — only top-level BEGIN:VEVENT
  // VALARM sub-components are safely ignored because we only look at
  // DTSTART/DTEND/STATUS lines and the outer split is on VEVENT.
  const parts = text.split("BEGIN:VEVENT");
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split("END:VEVENT")[0];
    const lines = block.split("\n");

    let start: string | null = null;
    let end: string | null = null;
    let cancelled = false;

    for (const line of lines) {
      if (line.startsWith("DTSTART")) {
        start = extractDate(line);
      } else if (line.startsWith("DTEND")) {
        end = extractDate(line);
      } else if (line.trim() === "STATUS:CANCELLED") {
        cancelled = true;
      }
    }

    if (cancelled || !start || !end) continue;

    // Guard against runaway events (> 365 days)
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (endMs - startMs > 365 * 24 * 60 * 60 * 1000) continue;

    events.push({ start, end });
  }

  return events;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/ical-parser.test.ts 2>&1 | tail -5
```

Expected: `✓ lib/__tests__/ical-parser.test.ts (10)`

- [ ] **Step 5: Commit**

```bash
git add web/lib/ical-parser.ts web/lib/__tests__/ical-parser.test.ts
git commit -m "feat(ical): add ical-parser with RFC 5545 line-unfolding"
```

---

### Task 3: Create `lib/ical-exporter.ts` with tests

**Files:**
- Create: `web/lib/ical-exporter.ts`
- Create: `web/lib/__tests__/ical-exporter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/ical-exporter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateIcal } from "@/lib/ical-exporter";
import type { ShelterBooking } from "@/types/booking";

function makeBooking(overrides: Partial<ShelterBooking> = {}): ShelterBooking {
  return {
    id: "booking-1",
    bookable_shelter_id: "shelter-1",
    guest_name: "Lars Hansen",
    guest_email: "lars@test.dk",
    guest_count: 3,
    check_in: "2026-06-01",
    check_out: "2026-06-03",
    message: null,
    status: "confirmed",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("generateIcal", () => {
  it("wraps output in VCALENDAR", () => {
    const out = generateIcal("Test Shelter", [], []);
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out).toContain("END:VCALENDAR");
    expect(out).toContain("PRODID:-//ShelterDK//Booking//DA");
  });

  it("includes confirmed booking with guest name", () => {
    const out = generateIcal("Test", [makeBooking()], []);
    expect(out).toContain("SUMMARY:Booking: Lars Hansen (3 pers.)");
    expect(out).toContain("DTSTART;VALUE=DATE:20260601");
    expect(out).toContain("DTEND;VALUE=DATE:20260603");
    expect(out).toContain("UID:booking-1@shelterdk.dk");
  });

  it("includes pending booking with Afventer prefix", () => {
    const out = generateIcal("Test", [makeBooking({ status: "pending" })], []);
    expect(out).toContain("SUMMARY:Afventer: Lars Hansen (3 pers.)");
  });

  it("excludes rejected and cancelled bookings", () => {
    const out = generateIcal(
      "Test",
      [makeBooking({ status: "rejected" }), makeBooking({ status: "cancelled" })],
      []
    );
    expect(out).not.toContain("SUMMARY:Booking:");
    expect(out).not.toContain("SUMMARY:Afventer:");
  });

  it("includes manual blocked date as Blokeret", () => {
    const out = generateIcal("Test", [], [{ date: "2026-07-10", source: "manual" }]);
    expect(out).toContain("SUMMARY:Blokeret");
    expect(out).toContain("DTSTART;VALUE=DATE:20260710");
    expect(out).toContain("DTEND;VALUE=DATE:20260711");
  });

  it("includes ical-synced blocked dates", () => {
    const out = generateIcal("Test", [], [{ date: "2026-07-10", source: "ical_sync" }]);
    expect(out).toContain("SUMMARY:Blokeret");
  });

  it("blocked date summary is exactly 'Blokeret' (no reason field in BlockedDateEntry)", () => {
    // BlockedDateEntry has {date, source} only — reason is out of scope for this interface
    const out = generateIcal("Test", [], [{ date: "2026-07-10", source: "manual" }]);
    expect(out).toContain("SUMMARY:Blokeret");
    expect(out).not.toContain("SUMMARY:Blokeret "); // no trailing text appended
  });

  it("DTEND for blocked date is date + 1 day", () => {
    const out = generateIcal("Test", [], [{ date: "2026-12-31", source: "manual" }]);
    expect(out).toContain("DTSTART;VALUE=DATE:20261231");
    expect(out).toContain("DTEND;VALUE=DATE:20270101");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/ical-exporter.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module '@/lib/ical-exporter'`

- [ ] **Step 3: Create `web/lib/ical-exporter.ts`**

```ts
import type { ShelterBooking } from "@/types/booking";

type BlockedDateEntry = { date: string; source: "manual" | "ical_sync" };

function isoToIcal(iso: string): string {
  // "2026-06-01" → "20260601"
  return iso.replace(/-/g, "");
}

function nextDay(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function vevent(uid: string, summary: string, dtstart: string, dtend: string): string {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DTSTART;VALUE=DATE:${isoToIcal(dtstart)}`,
    `DTEND;VALUE=DATE:${isoToIcal(dtend)}`,
    "END:VEVENT",
  ].join("\n");
}

export function generateIcal(
  shelterTitle: string,
  bookings: ShelterBooking[],
  blockedDates: BlockedDateEntry[]
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `PRODID:-//ShelterDK//Booking//DA`,
    `X-WR-CALNAME:${shelterTitle}`,
  ];

  for (const b of bookings) {
    if (b.status !== "confirmed" && b.status !== "pending") continue;
    const prefix = b.status === "confirmed" ? "Booking" : "Afventer";
    const summary = `${prefix}: ${b.guest_name} (${b.guest_count} pers.)`;
    lines.push(vevent(`${b.id}@shelterdk.dk`, summary, b.check_in, b.check_out));
  }

  for (const bd of blockedDates) {
    lines.push(vevent(`blocked-${bd.date}@shelterdk.dk`, "Blokeret", bd.date, nextDay(bd.date)));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/ical-exporter.test.ts 2>&1 | tail -5
```

Expected: `✓ lib/__tests__/ical-exporter.test.ts (8)`

- [ ] **Step 5: Commit**

```bash
git add web/lib/ical-exporter.ts web/lib/__tests__/ical-exporter.test.ts
git commit -m "feat(ical): add ical-exporter"
```

---

### Task 4: Add DB functions to `lib/booking-db.ts`

**Files:**
- Modify: `web/lib/booking-db.ts` (append at end of file)

- [ ] **Step 1: Append five new functions to `web/lib/booking-db.ts`**

Add after the existing `unblockDate` function:

```ts
// ─── iCal integration ────────────────────────────────────────────────────────

/** Returns blocked dates WITH source field — for owner dashboard legend. */
export async function getBlockedDatesWithSource(
  bookableShelterDbId: string
): Promise<{ date: string; source: "manual" | "ical_sync" }[]> {
  const { data } = await createAdminClient()
    .from("shelter_blocked_dates")
    .select("blocked_date, source")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .gte("blocked_date", new Date().toISOString().slice(0, 10))
    .order("blocked_date", { ascending: true });
  return (data ?? []).map((d) => ({
    date: d.blocked_date as string,
    source: (d.source ?? "manual") as "manual" | "ical_sync",
  }));
}

export async function saveIcalImportUrl(
  bookableShelterDbId: string,
  url: string | null
): Promise<void> {
  await createAdminClient()
    .from("bookable_shelters")
    .update({ ical_import_url: url })
    .eq("id", bookableShelterDbId);
}

export async function updateIcalLastSynced(
  bookableShelterDbId: string
): Promise<void> {
  await createAdminClient()
    .from("bookable_shelters")
    .update({ ical_last_synced_at: new Date().toISOString() })
    .eq("id", bookableShelterDbId);
}

export async function deleteIcalSyncedDates(
  bookableShelterDbId: string
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .delete()
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("source", "ical_sync");
}

export async function blockDatesFromSync(
  bookableShelterDbId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  await createAdminClient()
    .from("shelter_blocked_dates")
    .upsert(
      dates.map((d) => ({
        bookable_shelter_id: bookableShelterDbId,
        blocked_date: d,
        source: "ical_sync",
      }))
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/lib/booking-db.ts
git commit -m "feat(ical): add iCal DB functions to booking-db"
```

---

### Task 5: Create `lib/ical-sync.ts`

**Files:**
- Create: `web/lib/ical-sync.ts`

No unit tests for this file — it depends on external HTTP and DB. It will be integration-tested via the API routes.

- [ ] **Step 1: Create `web/lib/ical-sync.ts`**

```ts
import { parseIcal } from "@/lib/ical-parser";
import {
  deleteIcalSyncedDates,
  blockDatesFromSync,
  updateIcalLastSynced,
} from "@/lib/booking-db";

/** Expand {start, end} ranges into individual YYYY-MM-DD strings. Skips past dates. */
function expandDates(events: { start: string; end: string }[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const result = new Set<string>();
  for (const ev of events) {
    const cur = new Date(ev.start + "T12:00:00");
    const end = new Date(ev.end + "T12:00:00");
    while (cur < end) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (iso >= today) result.add(iso);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return Array.from(result).sort();
}

/** Normalise webcal:// to https:// so fetch() accepts the URL. */
function normaliseUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, "https://");
}

/**
 * Syncs a single external iCal feed into shelter_blocked_dates.
 * Only rows with source='ical_sync' are touched — manual blocks are preserved.
 * Throws if the feed is unreachable or not a valid iCal document.
 */
export async function syncIcalForShelter(
  shelterId: string,
  importUrl: string
): Promise<{ blockedCount: number }> {
  const url = normaliseUrl(importUrl);

  // 10-second timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let text: string;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }

  // Validate before touching DB
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Response does not contain BEGIN:VCALENDAR — not a valid iCal feed");
  }

  const events = parseIcal(text);
  const dates = expandDates(events);

  // Only mutate DB after successful fetch + parse
  await deleteIcalSyncedDates(shelterId);
  await blockDatesFromSync(shelterId, dates);
  await updateIcalLastSynced(shelterId);

  return { blockedCount: dates.length };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/lib/ical-sync.ts
git commit -m "feat(ical): add ical-sync core logic"
```

---

### Task 6: Create `.ics` export endpoint

**Files:**
- Create: `web/app/api/owner/[token]/calendar.ics/route.ts`

- [ ] **Step 1: Create the directory and route file**

```bash
mkdir -p "web/app/api/owner/[token]/calendar.ics"
```

Create `web/app/api/owner/[token]/calendar.ics/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getBookableShelterByOwnerToken, getBookingsForShelter, getBlockedDatesWithSource } from "@/lib/booking-db";
import { generateIcal } from "@/lib/ical-exporter";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return new Response("Not found", { status: 404 });

  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesWithSource(shelter.id),
  ]);

  const icsText = generateIcal(shelter.title, bookings, blockedDates);

  return new Response(icsText, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shelter-${shelter.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/owner/[token]/calendar.ics/route.ts"
git commit -m "feat(ical): add /api/owner/[token]/calendar.ics export endpoint"
```

---

### Task 7: Create settings and sync endpoints

**Files:**
- Create: `web/app/api/owner/[token]/settings/route.ts`
- Create: `web/app/api/owner/[token]/sync/route.ts`

- [ ] **Step 1: Create `settings` route**

```bash
mkdir -p "web/app/api/owner/[token]/settings"
```

Create `web/app/api/owner/[token]/settings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  saveIcalImportUrl,
} from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let url: string | null = body.ical_import_url ?? null;

  if (url !== null) {
    url = url.trim();
    if (url.length === 0) {
      url = null; // treat empty string as "clear the URL"
    } else {
      // Normalise webcal:// before saving
      url = url.replace(/^webcal:\/\//i, "https://");
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return NextResponse.json({ error: "Ugyldig URL — skal starte med http:// eller https://" }, { status: 400 });
      }
    }
  }

  await saveIcalImportUrl(shelter.id, url);

  // Trigger immediate sync if URL was provided
  let blockedCount = 0;
  let lastSynced: string | null = null;
  if (url) {
    try {
      const result = await syncIcalForShelter(shelter.id, url);
      blockedCount = result.blockedCount;
      lastSynced = new Date().toISOString();
    } catch (err) {
      console.error("Initial iCal sync failed:", err);
      // Don't fail the settings save — URL was saved, sync failed
      return NextResponse.json({ ok: true, blockedCount: 0, lastSynced: null, syncError: "Synk fejlede — tjek at URL'en er korrekt" });
    }
  }

  return NextResponse.json({ ok: true, blockedCount, lastSynced });
}
```

- [ ] **Step 2: Create `sync` route**

```bash
mkdir -p "web/app/api/owner/[token]/sync"
```

Create `web/app/api/owner/[token]/sync/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken } from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  if (!shelter.ical_import_url) {
    return NextResponse.json({ error: "Ingen iCal-URL konfigureret" }, { status: 400 });
  }

  try {
    const { blockedCount } = await syncIcalForShelter(shelter.id, shelter.ical_import_url);
    return NextResponse.json({ ok: true, blockedCount, lastSynced: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Synk fejlede";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "web/app/api/owner/[token]/settings/route.ts" "web/app/api/owner/[token]/sync/route.ts"
git commit -m "feat(ical): add settings PATCH and sync POST endpoints"
```

---

### Task 8: Create cron endpoint + Netlify scheduled function

**Files:**
- Create: `web/app/api/cron/ical-sync/route.ts`
- Create: `web/netlify/functions/ical-sync-cron.ts`

- [ ] **Step 1: Create cron API endpoint**

```bash
mkdir -p web/app/api/cron/ical-sync
```

Create `web/app/api/cron/ical-sync/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { syncIcalForShelter } from "@/lib/ical-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all shelters with an import URL
  const { data: shelters, error } = await createAdminClient()
    .from("bookable_shelters")
    .select("id, title, ical_import_url")
    .not("ical_import_url", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let synced = 0;
  const errors: string[] = [];

  // Sequential — avoids hammering external servers
  for (const shelter of shelters ?? []) {
    if (!shelter.ical_import_url) continue;
    try {
      await syncIcalForShelter(shelter.id, shelter.ical_import_url);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`iCal sync failed for shelter ${shelter.id}:`, msg);
      errors.push(`${shelter.title}: ${msg}`);
    }
  }

  return NextResponse.json({ ok: true, synced, errors });
}
```

- [ ] **Step 2: Create Netlify Scheduled Function**

Create `web/netlify/functions/ical-sync-cron.ts`:

```ts
import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/ical-sync`,
      { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } }
    );
    const body = await res.text();
    console.log("ical-sync-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ical-sync-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 * * * *", handler); // every hour on the hour
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/cron/ical-sync/route.ts web/netlify/functions/ical-sync-cron.ts
git commit -m "feat(ical): add cron endpoint and Netlify scheduled function"
```

---

### Task 9: Update owner page server component

**Files:**
- Modify: `web/app/(site)/owner/[token]/page.tsx`

- [ ] **Step 1: Switch to `getBlockedDatesWithSource`**

Open `web/app/(site)/owner/[token]/page.tsx`. Make two changes:

**Line 3** — update import:
```ts
// Before:
import { getBookableShelterByOwnerToken, getBookingsForShelter, getBlockedDatesForShelter } from "@/lib/booking-db";
// After:
import { getBookableShelterByOwnerToken, getBookingsForShelter, getBlockedDatesWithSource } from "@/lib/booking-db";
```

**Lines 20–23** — update the Promise.all call:
```ts
// Before:
  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesForShelter(shelter.id),
  ]);
// After:
  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesWithSource(shelter.id),
  ]);
```

The `initialBlockedDates` prop passed to `OwnerDashboard` changes from `string[]` to `{ date: string; source: "manual" | "ical_sync" }[]` automatically — the prop name stays the same.

- [ ] **Step 2: Update `OwnerDashboard` Props interface**

Open `web/components/owner/OwnerDashboard.tsx`. Find:
```ts
interface Props {
  shelter: BookableShelter;
  initialBookings: ShelterBooking[];
  initialBlockedDates: string[];
  ownerToken: string;
}
```

Replace with:
```ts
type BlockedDateEntry = { date: string; source: "manual" | "ical_sync" };

interface Props {
  shelter: BookableShelter;
  initialBookings: ShelterBooking[];
  initialBlockedDates: BlockedDateEntry[];
  ownerToken: string;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
```

Expected: no output — Props type now matches `getBlockedDatesWithSource` return type.

- [ ] **Step 4: Commit both files together**

```bash
git add "web/app/(site)/owner/[token]/page.tsx" web/components/owner/OwnerDashboard.tsx
git commit -m "feat(ical): owner page uses getBlockedDatesWithSource; update OwnerDashboard Props"
```

---

### Task 10: Update `OwnerDashboard` component

**Files:**
- Modify: `web/components/owner/OwnerDashboard.tsx`

The Props interface was already updated in Task 9 Step 2. Continue with the remaining targeted edits:

- [ ] **Step 1: Update state type**

Find:
```ts
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlockedDates);
```

Replace with:
```ts
  const [blockedDates, setBlockedDates] = useState<BlockedDateEntry[]>(initialBlockedDates);
```

- [ ] **Step 2: Add iCal state variables**

After the existing `const [copied, setCopied] = useState(false);` line, add:

```ts
  // iCal integration state
  const [icalImportUrl, setIcalImportUrl] = useState(shelter.ical_import_url ?? "");
  const [icalSavedUrl, setIcalSavedUrl] = useState(shelter.ical_import_url ?? "");
  const [icalLastSynced, setIcalLastSynced] = useState(shelter.ical_last_synced_at ?? null);
  const [icalSaving, setIcalSaving] = useState(false);
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalMsg, setIcalMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [icalCopied, setIcalCopied] = useState(false);
```

- [ ] **Step 3: Update `blockedSet` to split by source**

Find:
```ts
  const blockedSet = new Set(blockedDates);
```

Replace with:
```ts
  const manualBlockedSet = new Set(blockedDates.filter((d) => d.source === "manual").map((d) => d.date));
  const syncedBlockedSet = new Set(blockedDates.filter((d) => d.source === "ical_sync").map((d) => d.date));
```

- [ ] **Step 4: Update `DayCell` to receive both sets**

Find the `DayCell` function signature:
```ts
function DayCell({
  iso,
  events,
  blocked,
  isToday,
  isPast,
  onSelect,
  selected,
}: {
  iso: string;
  events: CalEvent[];
  blocked: boolean;
  isToday: boolean;
  isPast: boolean;
  onSelect: (iso: string) => void;
  selected: boolean;
})
```

Replace with:
```ts
function DayCell({
  iso,
  events,
  blocked,
  blockedSync,
  isToday,
  isPast,
  onSelect,
  selected,
}: {
  iso: string;
  events: CalEvent[];
  blocked: boolean;
  blockedSync: boolean;
  isToday: boolean;
  isPast: boolean;
  onSelect: (iso: string) => void;
  selected: boolean;
})
```

Inside `DayCell`, find:
```ts
  let dot: string | null = null;
  if (blocked) dot = "bg-primary/25";
  else if (confirmed) dot = "bg-emerald-500";
  else if (pending) dot = "bg-amber-400";
```

Replace with:
```ts
  let dot: string | null = null;
  if (blockedSync) dot = "bg-primary/40";
  else if (blocked) dot = "bg-primary/20";
  else if (confirmed) dot = "bg-emerald-500";
  else if (pending) dot = "bg-amber-400";
```

- [ ] **Step 5: Pass both sets to `DayCell` inside `MiniCalendar`**

`MiniCalendar` currently receives only `blockedSet`. Update its signature and the call sites:

Find `MiniCalendar`'s props interface:
```ts
  blockedSet: Set<string>;
```

Replace with:
```ts
  manualBlockedSet: Set<string>;
  syncedBlockedSet: Set<string>;
```

Inside `MiniCalendar`, find where `DayCell` is rendered:
```tsx
              <DayCell
                key={iso}
                iso={iso}
                events={events.filter((e) => iso >= e.checkIn && iso < e.checkOut)}
                blocked={blockedSet.has(iso)}
                isToday={iso === todayIso}
                isPast={iso < todayIso}
                onSelect={onSelect}
                selected={iso === selectedDate}
              />
```

Replace with:
```tsx
              <DayCell
                key={iso}
                iso={iso}
                events={events.filter((e) => iso >= e.checkIn && iso < e.checkOut)}
                blocked={manualBlockedSet.has(iso)}
                blockedSync={syncedBlockedSet.has(iso)}
                isToday={iso === todayIso}
                isPast={iso < todayIso}
                onSelect={onSelect}
                selected={iso === selectedDate}
              />
```

- [ ] **Step 6: Update the two `MiniCalendar` call sites in the main render**

These are two separate targeted replacements — do them one at a time.

**Edit 1 of 2 — first call site (current month, uses `calYear`/`calMonth`):**

Find:
```tsx
            <MiniCalendar
              year={calYear}
              month={calMonth}
              events={calEvents}
              blockedSet={blockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
```

Replace with:
```tsx
            <MiniCalendar
              year={calYear}
              month={calMonth}
              events={calEvents}
              manualBlockedSet={manualBlockedSet}
              syncedBlockedSet={syncedBlockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
```

**Edit 2 of 2 — second call site (next month, uses `year2`/`month2`):**

Find:
```tsx
            <MiniCalendar
              year={year2}
              month={month2}
              events={calEvents}
              blockedSet={blockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
```

Replace with:
```tsx
            <MiniCalendar
              year={year2}
              month={month2}
              events={calEvents}
              manualBlockedSet={manualBlockedSet}
              syncedBlockedSet={syncedBlockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
```

- [ ] **Step 7: Update block handler to push `{date, source}` objects**

Find inside `handleBlock`:
```ts
      setBlockedDates((prev) => Array.from(new Set([...prev, ...newDates])));
```

Replace with:
```ts
      setBlockedDates((prev) => {
        const existing = new Set(prev.map((d) => d.date));
        const toAdd = newDates.filter((d) => !existing.has(d)).map((d) => ({ date: d, source: "manual" as const }));
        return [...prev, ...toAdd];
      });
```

- [ ] **Step 8: Update calendar legend**

Find the legend section (the `hidden sm:flex items-center gap-3` div):
```tsx
            {[
              { color: "bg-emerald-500", label: "Bekræftet" },
              { color: "bg-amber-400", label: "Afventer" },
              { color: "bg-primary/20", label: "Blokeret" },
            ].map(({ color, label }) => (
```

Replace with:
```tsx
            {[
              { color: "bg-emerald-500", label: "Bekræftet" },
              { color: "bg-amber-400", label: "Afventer" },
              { color: "bg-primary/20", label: "Blokeret" },
              { color: "bg-primary/40", label: "Synket" },
            ].map(({ color, label }) => (
```

- [ ] **Step 9: Update `selectedBlocked` to check both sets**

Find:
```ts
  const selectedBlocked = selectedDate ? blockedSet.has(selectedDate) : false;
```

Replace with:
```ts
  const selectedBlocked = selectedDate ? (manualBlockedSet.has(selectedDate) || syncedBlockedSet.has(selectedDate)) : false;
  const selectedBlockedSync = selectedDate ? syncedBlockedSet.has(selectedDate) : false;
```

Find the selected date detail panel where blocked is shown:
```tsx
              {selectedBlocked && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-sm text-primary/60 mb-2">
                  🔒 Blokeret dato
                </div>
              )}
```

Replace with:
```tsx
              {selectedBlocked && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-sm text-primary/60 mb-2">
                  🔒 {selectedBlockedSync ? "Blokeret via kalendersynk" : "Manuelt blokeret dato"}
                </div>
              )}
```

- [ ] **Step 10: Add iCal helper functions and compute the `.ics` URL**

After the `bookingPageUrl` const, add:

```ts
  const icalExportUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/owner/${ownerToken}/calendar.ics`
    : `https://shelterdk.dk/api/owner/${ownerToken}/calendar.ics`;

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "lige nu";
    if (mins < 60) return `${mins} minut${mins !== 1 ? "ter" : ""} siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} time${hours !== 1 ? "r" : ""} siden`;
    return `${Math.floor(hours / 24)} dag${Math.floor(hours / 24) !== 1 ? "e" : ""} siden`;
  }

  const handleIcalSave = async () => {
    setIcalSaving(true);
    setIcalMsg(null);
    try {
      const res = await fetch(`/api/owner/${ownerToken}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_import_url: icalImportUrl || null }),
      });
      const data = await res.json();
      if (!res.ok || data.syncError) {
        setIcalMsg({ ok: false, text: data.syncError ?? data.error ?? "Fejl" });
      } else {
        setIcalSavedUrl(icalImportUrl);
        setIcalLastSynced(data.lastSynced);
        setIcalMsg({ ok: true, text: `Gemt og synket — ${data.blockedCount} datoer blokeret` });
      }
    } catch {
      setIcalMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setIcalSaving(false);
    }
  };

  const handleIcalSync = async () => {
    setIcalSyncing(true);
    setIcalMsg(null);
    try {
      const res = await fetch(`/api/owner/${ownerToken}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIcalMsg({ ok: false, text: data.error ?? "Synk fejlede" });
      } else {
        setIcalLastSynced(data.lastSynced);
        setIcalMsg({ ok: true, text: `Synkroniseret — ${data.blockedCount} datoer blokeret` });
      }
    } catch {
      setIcalMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setIcalSyncing(false);
    }
  };
```

- [ ] **Step 11: Add "Kalender-integration" section to render**

Insert the following JSX between the "Bloker datoer" section's closing `</section>` tag and the "Embed-kode" section:

```tsx
      {/* ── Kalender-integration ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5 space-y-6">
        <h2 className="font-serif text-lg font-bold text-primary">Kalender-integration</h2>

        {/* Export */}
        <div>
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Din booking-kalender (.ics)</p>
          <p className="text-xs text-primary/40 mb-3">Abonnér én gang i Google Kalender, Apple Kalender eller ONE.com — nye bookinger synkroniserer automatisk.</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-primary/60 bg-primary/[0.03] border border-primary/10 rounded-lg px-3 py-2 flex-1 truncate">
              {icalExportUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(icalExportUrl); setIcalCopied(true); setTimeout(() => setIcalCopied(false), 1500); }}
              className="shrink-0 rounded-lg bg-white border border-primary/15 shadow-sm px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              {icalCopied ? "✓ Kopieret!" : "Kopiér URL"}
            </button>
          </div>
        </div>

        {/* Import */}
        <div>
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Synk fra ekstern kalender</p>
          <p className="text-xs text-primary/40 mb-3">
            Indsæt en iCal-URL fra ONE.com, Airbnb, Google Kalender el. lign. — ShelterDK blokerer automatisk de datoer der er optaget i din kalender.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={icalImportUrl}
              onChange={(e) => setIcalImportUrl(e.target.value)}
              placeholder="https://calendar.one.com/..."
              title="Datoer du fjerner fra din eksterne kalender genoppættes automatisk ved næste synk — fjern dem i din kalender, ikke her"
              className="flex-1 rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
            />
            <button
              onClick={handleIcalSave}
              disabled={icalSaving}
              className="shrink-0 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
            >
              {icalSaving ? "Gemmer…" : "Gem & synk"}
            </button>
          </div>

          {icalSavedUrl && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <p className="text-xs text-primary/40">
                Sidst synkroniseret: {icalLastSynced ? timeAgo(icalLastSynced) : "aldrig"}
              </p>
              <button
                onClick={handleIcalSync}
                disabled={icalSyncing}
                className="text-xs text-accent hover:text-accent/70 font-medium disabled:opacity-40 transition-colors"
              >
                {icalSyncing ? "Synker…" : "Synk nu"}
              </button>
            </div>
          )}

          {icalMsg && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${icalMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
              {icalMsg.text}
            </div>
          )}
        </div>
      </section>
```

- [ ] **Step 12: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -20
```

Expected: no output.

- [ ] **Step 13: Commit**

```bash
git add web/components/owner/OwnerDashboard.tsx
git commit -m "feat(ical): OwnerDashboard — iCal export/import UI + split blocked legend"
```

---

### Task 11: Run full test suite and final check

- [ ] **Step 1: Run all tests**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass. The new ical-parser and ical-exporter tests should pass. Pre-existing test errors in `app/api/experiences/__tests__/` are unrelated and can be ignored.

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -20
```

Expected: no output.

- [ ] **Step 3: Add `CRON_SECRET` env var note**

Add `CRON_SECRET` to your Netlify environment variables (Netlify dashboard → Site settings → Environment variables). Set it to any long random string (e.g., output of `openssl rand -hex 32`). This same value must be in both Netlify env vars (for the scheduled function) and the production Supabase/Netlify env.

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git status  # verify nothing untracked or unstaged
git push
```
