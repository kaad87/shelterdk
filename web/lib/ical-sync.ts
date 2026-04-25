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
