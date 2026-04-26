# iCal Integration — ShelterDK Booking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shelter owners can export their booking calendar as a `.ics` feed (subscribe once in Google Calendar, Apple Calendar, ONE.com etc.) and import an external calendar (ONE.com, Airbnb, Google) to automatically block dates in ShelterDK — preventing double-bookings without any manual intervention.

**Approach:** Hybrid — automatic hourly cron sync (primary) + manual "Synk nu" button (secondary). Export is stateless (generated live from DB on every request). Import uses full-sync semantics: only dates tagged `source='ical_sync'` are overwritten; manually blocked dates are never touched.

---

## Data model

The SQL has already been applied to production. For reference:

```sql
-- Already applied:
ALTER TABLE bookable_shelters
  ADD COLUMN IF NOT EXISTS ical_import_url      text,
  ADD COLUMN IF NOT EXISTS ical_last_synced_at  timestamptz;

ALTER TABLE shelter_blocked_dates
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'ical_sync'));
```

### Types update (`types/booking.ts`)

`BookableShelter` gains:
```ts
ical_import_url:     string | null;
ical_last_synced_at: string | null;
```

`ShelterBlockedDate` gains:
```ts
source: 'manual' | 'ical_sync';
```

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/ical-parser.ts` | **Create** | Parse raw iCal text → `{start, end}[]` date ranges |
| `lib/ical-exporter.ts` | **Create** | Generate `.ics` text from bookings + blocked dates |
| `lib/ical-sync.ts` | **Create** | Core sync logic: fetch → unfold → parse → delete ical_sync rows → insert new |
| `lib/booking-db.ts` | **Modify** | Add `saveIcalImportUrl`, `updateIcalLastSynced`, `deleteIcalSyncedDates`, `blockDatesFromSync`, `getBlockedDatesWithSource` |
| `types/booking.ts` | **Modify** | Add `ical_import_url`, `ical_last_synced_at` to `BookableShelter`; `source` to `ShelterBlockedDate` |
| `app/api/owner/[token]/calendar.ics/route.ts` | **Create** | Export endpoint — returns `.ics` file |
| `app/api/owner/[token]/settings/route.ts` | **Create** | PATCH — save `ical_import_url` |
| `app/api/owner/[token]/sync/route.ts` | **Create** | POST — trigger manual sync |
| `app/api/cron/ical-sync/route.ts` | **Create** | GET — protected cron endpoint called by Netlify scheduled function |
| `web/netlify/functions/ical-sync-cron.ts` | **Create** | Netlify Scheduled Function — calls cron endpoint hourly |
| `app/(site)/owner/[token]/page.tsx` | **Modify** | Pass `initialBlockedDates` as `{date,source}[]` instead of `string[]` |
| `components/owner/OwnerDashboard.tsx` | **Modify** | Add "Kalender-integration" section; update blocked date legend |

---

## Component designs

### `lib/ical-parser.ts`

Parses raw iCal (RFC 5545) text. No external package — pure text parsing.

```ts
export interface IcalEvent { start: string; end: string } // "YYYY-MM-DD"

export function unfoldIcal(raw: string): string
export function parseIcal(raw: string): IcalEvent[]
```

**RFC 5545 compliance requirements:**

**Line unfolding (§3.1) — required before any parsing:** Long property values are split across lines with a leading space or tab (line folding). Real-world feeds from Airbnb, Google Calendar, and ONE.com all use this. The `unfoldIcal` function must strip `\r\n` followed by a space or tab before any further processing:
```ts
raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n")
```
`parseIcal` calls `unfoldIcal` first, then operates on the unfolded string.

**`DTSTART` formats handled:**
- `DTSTART;VALUE=DATE:20260601` → `"2026-06-01"` (all-day event — most common for blocked ranges)
- `DTSTART:20260601T140000Z` → extract date portion only (`"2026-06-01"`)
- `DTSTART;TZID=Europe/Copenhagen:20260601T140000` → extract date portion only (`"2026-06-01"`)

The TZID case is the most common format from ONE.com and Airbnb for Danish owners. Extract the date string from the value after the colon — do not attempt timezone conversion. For shelter availability purposes, the calendar date is what matters, not the exact time.

**Additional parsing rules:**
- Skip events with `STATUS:CANCELLED`
- `DTEND` uses the same three formats as `DTSTART`
- `VALARM` sub-components inside `VEVENT` are ignored (do not split on inner `BEGIN:` tokens — only split on `BEGIN:VEVENT` / `END:VEVENT` at the top level)
- Events spanning more than 365 days are skipped (guards against runaway inserts from malformed feeds)
- Return `[]` if `BEGIN:VCALENDAR` is not present in the unfolded text (rejects non-iCal responses)

### `lib/ical-exporter.ts`

Generates `.ics` text from DB data.

```ts
export function generateIcal(
  shelterTitle: string,
  bookings: ShelterBooking[],
  blockedDates: { date: string; source: 'manual' | 'ical_sync' }[]
): string
```

Output includes:
- `VCALENDAR` wrapper with `PRODID:-//ShelterDK//Booking//DA`, `VERSION:2.0`, `CALSCALE:GREGORIAN`
- `VEVENT` per **confirmed** booking: `SUMMARY:Booking: {guest_name} ({guest_count} pers.)`, `DTSTART;VALUE=DATE:{check_in}`, `DTEND;VALUE=DATE:{check_out}`, `UID:{id}@shelterdk.dk`
- `VEVENT` per **pending** booking: `SUMMARY:Afventer: {guest_name} ({guest_count} pers.)`
- `VEVENT` per blocked date: `SUMMARY:Blokeret` (append reason if present), single-day events (DTEND = date + 1 day)
- All ical-synced blocked dates are included in export (no circular loop risk — the owner's calendar app will simply see a ShelterDK event alongside the original ONE.com event, which is harmless)

**Security note:** The `.ics` URL is protected only by the `owner_token` UUID. This token is permanent — rotating it would break existing calendar subscriptions, which is unacceptable UX. The token therefore has no expiry. The export exposes `guest_name` and `guest_count` in `SUMMARY` fields; anyone with the URL can read all booking names. This is an explicit privacy tradeoff: the URL should be treated as a secret link. Out of scope for MVP: token rotation mechanism.

### `lib/ical-sync.ts`

Core sync logic, called by both manual sync endpoint and cron job.

```ts
export async function syncIcalForShelter(
  shelterId: string,
  importUrl: string
): Promise<{ blockedCount: number }>
```

Steps:
1. Normalise URL: convert `webcal://` to `https://` (must happen here, not only at save-time, in case URL was stored before normalisation existed)
2. `fetch(importUrl)` with 10-second timeout (via `AbortController`)
3. Validate response: check `BEGIN:VCALENDAR` is present after unfolding — if not, throw and abort without touching DB
4. `parseIcal(text)` → array of `{start, end}` ranges
5. Expand ranges to individual `YYYY-MM-DD` dates (skip past dates)
6. `deleteIcalSyncedDates(shelterId)` — removes all `source='ical_sync'` rows for this shelter
7. `blockDatesFromSync(shelterId, dates)` — inserts with `source='ical_sync'`
8. `updateIcalLastSynced(shelterId)` — sets `ical_last_synced_at = now()`
9. Returns `{ blockedCount: dates.length }`

**Error handling:** If fetch, validation, or parse fails at any step before step 6, the function throws without modifying the DB (existing `ical_sync` dates are preserved). Steps 6–8 are the only DB-mutating steps.

**Owner manual unblock of ical-synced dates:** If an owner manually unblocks a date that was ical-synced, it will be re-added at the next hourly sync. This is intentional and correct — the source of truth is the external calendar. Owners should remove the event from their external calendar, not from ShelterDK. This behaviour should be documented in the UI tooltip.

### `lib/booking-db.ts` additions

```ts
// New function — returns dates WITH source for dashboard legend
export async function getBlockedDatesWithSource(
  shelterId: string
): Promise<{ date: string; source: 'manual' | 'ical_sync' }[]>

export async function saveIcalImportUrl(shelterId: string, url: string | null): Promise<void>
export async function updateIcalLastSynced(shelterId: string): Promise<void>
export async function deleteIcalSyncedDates(shelterId: string): Promise<void>
export async function blockDatesFromSync(shelterId: string, dates: string[]): Promise<void>
```

The existing `getBlockedDatesForShelter` (returns `string[]`) is kept unchanged — it is used by the availability endpoint for guests and does not need source info. The owner dashboard switches to `getBlockedDatesWithSource`.

**`unblockDate` source handling:** The existing `unblockDate(shelterId, date)` deletes any row regardless of source. This is acceptable: if an owner manually unblocks an ical-synced date, it will be re-added at next sync (expected behaviour — see above). No change needed to `unblockDate`.

### `app/api/owner/[token]/calendar.ics/route.ts`

```
GET /api/owner/{token}/calendar.ics
```

- `export const dynamic = "force-dynamic"` — required to prevent Next.js 14 static caching
- Authenticates via `owner_token`
- Fetches all bookings + blocked dates (with source) for shelter
- Calls `generateIcal(...)`
- Returns `new Response(icsText, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=\"shelter-{slug}.ics\"", "Cache-Control": "no-store" } })`

### `app/api/owner/[token]/settings/route.ts`

```
PATCH /api/owner/{token}/settings
Body: { ical_import_url: string | null }
export const dynamic = "force-dynamic"
```

- Validates URL: must start with `http://`, `https://`, or `webcal://`
- Converts `webcal://` to `https://` before saving
- Saves to `bookable_shelters.ical_import_url`
- If URL is non-null, triggers an immediate sync via `syncIcalForShelter()`
- Returns `{ ok: true, blockedCount: N, lastSynced: ISO }`

### `app/api/owner/[token]/sync/route.ts`

```
POST /api/owner/{token}/sync
export const dynamic = "force-dynamic"
```

- Reads `ical_import_url` from shelter
- Returns 400 if no URL configured
- Calls `syncIcalForShelter(shelterId, importUrl)`
- Returns `{ ok: true, blockedCount: N, lastSynced: ISO }`

### `app/api/cron/ical-sync/route.ts`

```
GET /api/cron/ical-sync
Header: x-cron-secret: {CRON_SECRET}
export const dynamic = "force-dynamic"
```

- Verifies `CRON_SECRET` env var matches header
- Fetches all shelters WHERE `ical_import_url IS NOT NULL`
- Syncs each sequentially (not parallel) — avoids hammering external servers
- **Scale ceiling acknowledged:** At ~8 seconds per shelter (generous estimate), a 10-shelter cap per cron run stays well within Netlify's background function timeout. If the shelter count grows beyond ~20 with import URLs, pagination or a queue will be needed. For MVP this is not a concern.
- Logs errors per shelter but continues to next shelter on failure
- Returns `{ ok: true, synced: N, errors: string[] }`

### `web/netlify/functions/ical-sync-cron.ts`

Uses the established project pattern (matching `sync-affiliate-products.ts`):

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
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ical-sync-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 * * * *", handler); // every hour
```

### `app/(site)/owner/[token]/page.tsx` changes

- Switch from `getBlockedDatesForShelter` (returns `string[]`) to `getBlockedDatesWithSource` (returns `{date, source}[]`)
- Pass `initialBlockedDates: { date: string; source: 'manual' | 'ical_sync' }[]` to `OwnerDashboard`

### `components/owner/OwnerDashboard.tsx` changes

**Props change:**
```ts
initialBlockedDates: { date: string; source: 'manual' | 'ical_sync' }[]
```

**`blockedSet` splits into two sets:**
```ts
const manualBlockedSet = new Set(blockedDates.filter(d => d.source === 'manual').map(d => d.date))
const syncedBlockedSet = new Set(blockedDates.filter(d => d.source === 'ical_sync').map(d => d.date))
```

**Calendar legend update:** `DayCell` receives both sets. Manual blocked = light grey dot. Synk blocked = darker grey dot.

**New section "Kalender-integration"** inserted between "Bloker datoer" and "Embed-kode":

*Export card:*
- Heading: "Din booking-kalender"
- `.ics` URL displayed + copy button
- Helper: "Tilføj URL i din kalender-app én gang — nye bookinger synkroniserer automatisk"

*Import card:*
- Heading: "Synk fra ekstern kalender"
- Text field for iCal URL with placeholder `"https://calendar.one.com/..."` and tooltip: "Datoer du fjerner fra din eksterne kalender genoppættes automatisk ved næste synk — fjern dem i din kalender, ikke her"
- "Gem & synk" button → PATCH /settings, then refreshes component state
- If URL saved: "Sidst synkroniseret: X minutter siden" status line + "Synk nu" button → POST /sync
- Sync result shown inline: "Synkroniseret — {N} datoer blokeret"

---

## Availability window note

The current `getUnavailableDates()` function (used on the guest booking page) caps its query to 90 days. Ical-synced blocked dates beyond 90 days will exist in the DB but will not appear as unavailable to booking guests. **This is a known limitation for MVP.** Guests attempting to book beyond 90 days are currently unsupported by the calendar UI anyway. Extending the window is a future task.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Shared secret between Netlify scheduled function and `/api/cron/ical-sync` |

---

## Out of scope

- Multiple import sources per shelter (one URL is enough for MVP)
- Two-way sync (write back to external calendar)
- Conflict resolution between import-synced blocks and existing pending bookings (synced dates block new bookings only; existing pending bookings are unaffected)
- Push notifications on sync changes
- Token rotation mechanism (rotating `owner_token` breaks existing `.ics` subscriptions)
- Extending the 90-day availability window
