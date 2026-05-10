import { parseIcal } from "@/lib/ical-parser";
import {
  blockDatesFromSync,
  updateIcalLastSynced,
} from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";

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

  // Upsert desired dates first, then remove stale synced dates.
  // This avoids wiping the whole sync-state if a later insert chunk fails.
  await blockDatesFromSync(shelterId, dates);

  const supabase = createAdminClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("shelter_blocked_dates")
    .select("blocked_date")
    .eq("bookable_shelter_id", shelterId)
    .eq("source", "ical_sync");
  if (existingError) {
    throw new Error(`Kunne ikke læse eksisterende kalendersynk: ${existingError.message}`);
  }

  const desiredDates = new Set(dates);
  const staleDates = (existingRows ?? [])
    .map((row) => row.blocked_date as string)
    .filter((date) => !desiredDates.has(date));

  if (staleDates.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < staleDates.length; i += chunkSize) {
      const chunk = staleDates.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("shelter_blocked_dates")
        .delete()
        .eq("bookable_shelter_id", shelterId)
        .eq("source", "ical_sync")
        .in("blocked_date", chunk);
      if (error) {
        throw new Error(`Kunne ikke rydde gamle synk-datoer: ${error.message}`);
      }
    }
  }

  await updateIcalLastSynced(shelterId);

  return { blockedCount: dates.length };
}
