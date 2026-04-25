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
