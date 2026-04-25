# iCal Integration — ShelterDK Booking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shelter owners can export their booking calendar as a `.ics` feed (subscribe once in Google Calendar, Apple Calendar, ONE.com etc.) and import an external calendar (ONE.com, Airbnb, Google) to automatically block dates in ShelterDK — preventing double-bookings without any manual intervention.

**Approach:** Hybrid — automatic hourly cron sync (primary) + manual "Synk nu" button (secondary). Export is stateless (generated live from DB on every request). Import uses full-sync semantics: only dates tagged `source='ical_sync'` are overwritten; manually blocked dates are never touched.

---

## Data model

The SQL has already been applied to production. For reference:

```sql
-- Already run:
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
|------|--------|---------------|
| `lib/ical-parser.ts` | **Create** | Parse raw iCal text → `{start, end}[]` date ranges |
| `lib/ical-exporter.ts` | **Create** | Generate `.ics` text from bookings + blocked dates |
| `lib/ical-sync.ts` | **Create** | Core sync logic: fetch → parse → delete ical_sync rows → insert new |
| `lib/booking-db.ts` | **Modify** | Add `saveIcalImportUrl`, `updateIcalLastSynced`, `deleteIcalSyncedDates`, `blockDatesFromSync` |
| `types/booking.ts` | **Modify** | Add `ical_import_url`, `ical_last_synced_at` to `BookableShelter`; `source` to `ShelterBlockedDate` |
| `app/api/owner/[token]/calendar.ics/route.ts` | **Create** | Export endpoint — returns `.ics` file |
| `app/api/owner/[token]/settings/route.ts` | **Create** | PATCH — save `ical_import_url` |
| `app/api/owner/[token]/sync/route.ts` | **Create** | POST — trigger manual sync |
| `app/api/cron/ical-sync/route.ts` | **Create** | GET — Netlify scheduled function (hourly) |
| `netlify/functions/ical-sync-cron.ts` | **Create** | Netlify Scheduled Function wrapper |
| `components/owner/OwnerDashboard.tsx` | **Modify** | Add "Kalender-integration" section |

---

## Component designs

### `lib/ical-parser.ts`

Parses raw iCal (RFC 5545) text. No external package — pure text parsing.

```ts
export interface IcalEvent { start: string; end: string } // "YYYY-MM-DD"

export function parseIcal(raw: string): IcalEvent[]
```

Logic:
- Split on `BEGIN:VEVENT` / `END:VEVENT`
- Extract `DTSTART` and `DTEND` lines (handle both `DATE` and `DATE-TIME` formats)
- Convert to `YYYY-MM-DD` strings (local date, not UTC)
- Skip events with `STATUS:CANCELLED`
- Return array of `{start, end}` ranges

### `lib/ical-exporter.ts`

Generates `.ics` text from DB data.

```ts
export function generateIcal(
  shelterTitle: string,
  bookings: ShelterBooking[],
  blockedDates: ShelterBlockedDate[]
): string
```

Output includes:
- `VCALENDAR` wrapper with `PRODID:-//ShelterDK//Booking//DA`
- `VEVENT` per **confirmed** booking: summary `"Booking: {guest_name} ({guest_count} pers.)"`, `DTSTART`/`DTEND` = check_in/check_out
- `VEVENT` per **pending** booking: summary `"Afventer: {guest_name} ({guest_count} pers.)"`
- `VEVENT` per blocked date: summary `"Blokeret"` (with reason if present), single-day or range
- `UID` generated as `{id}@shelterdk.dk`
- No external npm packages

### `lib/ical-sync.ts`

Core sync logic, called by both manual sync endpoint and cron job.

```ts
export async function syncIcalForShelter(
  shelterId: string,
  importUrl: string
): Promise<{ blockedCount: number }>
```

Steps:
1. `fetch(importUrl)` with 10s timeout
2. `parseIcal(text)` → array of `{start, end}` ranges
3. Expand ranges to individual `YYYY-MM-DD` dates
4. `deleteIcalSyncedDates(shelterId)` — removes all `source='ical_sync'` rows
5. `blockDatesFromSync(shelterId, dates)` — inserts with `source='ical_sync'`
6. `updateIcalLastSynced(shelterId)` — sets `ical_last_synced_at = now()`
7. Returns `{ blockedCount: dates.length }`

Error handling: If fetch or parse fails, log error and skip (do not delete existing synced dates).

### `app/api/owner/[token]/calendar.ics/route.ts`

```
GET /api/owner/{token}/calendar.ics
```

- Authenticates via `owner_token`
- Fetches all bookings + blocked dates for shelter
- Calls `generateIcal(...)` 
- Returns response with `Content-Type: text/calendar; charset=utf-8`
- `Content-Disposition: attachment; filename="shelter-{slug}.ics"`
- `Cache-Control: no-store` (always fresh)

### `app/api/owner/[token]/settings/route.ts`

```
PATCH /api/owner/{token}/settings
Body: { ical_import_url: string | null }
```

- Validates URL format (must start with `http://` or `https://`, contain `webcal://` is converted to `https://`)
- Saves to `bookable_shelters.ical_import_url`
- Triggers an immediate sync if URL is provided
- Returns `{ ok: true, shelter: updatedShelter }`

### `app/api/owner/[token]/sync/route.ts`

```
POST /api/owner/{token}/sync
```

- Reads `ical_import_url` from shelter
- Returns 400 if no URL configured
- Calls `syncIcalForShelter(...)`
- Returns `{ ok: true, blockedCount: N, lastSynced: ISO }`

### `app/api/cron/ical-sync/route.ts`

```
GET /api/cron/ical-sync
Header: x-cron-secret: {CRON_SECRET}
```

- Verifies `CRON_SECRET` env var
- Fetches all shelters WHERE `ical_import_url IS NOT NULL`
- Calls `syncIcalForShelter()` for each (sequential, not parallel — avoids rate limits)
- Returns `{ ok: true, synced: N, errors: [...] }`

### `netlify/functions/ical-sync-cron.ts`

Netlify Scheduled Function:

```ts
import type { Config } from "@netlify/functions";

export default async function handler() {
  await fetch(`${process.env.URL}/api/cron/ical-sync`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });
}

export const config: Config = {
  schedule: "@hourly",
};
```

### `components/owner/OwnerDashboard.tsx` changes

New section "Kalender-integration" inserted between "Bloker datoer" and "Embed-kode":

**Export card:**
- Label: "Din booking-kalender"
- Shows full `.ics` URL
- Copy button
- Helper text: "Tilføj denne URL i din kalender-app én gang — nye bookinger synkroniserer automatisk"

**Import card:**
- Label: "Synk fra ekstern kalender"
- Text input for iCal URL (placeholder: "https://calendar.one.com/...")
- "Gem & synk" button — calls PATCH /settings then POST /sync
- "Sidst synkroniseret: X minutter siden" status line (hidden if never synced)
- "Synk nu" button (visible after URL is saved)

**Calendar legend update:**
- Blokeret manuelt: lys grå dot
- Blokeret via synk: mørkere grå dot (slightly darker to distinguish)

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Shared secret between Netlify scheduled function and `/api/cron/ical-sync` |

---

## Error handling

| Scenario | Behaviour |
|----------|----------|
| External URL unreachable | Log, skip, keep existing `ical_sync` dates |
| Invalid iCal format | Log, skip, keep existing dates |
| URL returns non-iCal content | Detected by missing `BEGIN:VCALENDAR`, skip |
| `webcal://` URL | Auto-converted to `https://` before fetch |
| Event spans > 365 days | Capped to prevent runaway inserts |

---

## Out of scope

- Multiple import sources per shelter (one URL is enough for MVP)
- Two-way sync (write back to external calendar)
- Conflict resolution between import-synced and pending bookings (synced dates simply block new bookings; existing pending bookings are unaffected)
- Push notifications on sync changes
