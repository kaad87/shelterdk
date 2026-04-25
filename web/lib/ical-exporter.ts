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
