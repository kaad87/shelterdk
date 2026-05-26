/**
 * Tidsfrist for samme-dag-booking.
 *
 * Postgres TIME-feltet `bookable_shelters.same_day_booking_deadline`
 * serialiseres som "HH:MM:SS" (eller "HH:MM" hvis manuel input). Vi
 * sammenligner med aktuel tid i Europe/Copenhagen (DK lokal tid) for at
 * matche ejerens og gæstens mentale model.
 */

/**
 * Returnerer aktuel dato (YYYY-MM-DD) og minutter siden midnat for
 * en given timezone — primært til at sammenligne med en HH:MM-deadline.
 */
export function getNowInTimeZone(
  now: Date = new Date(),
  timeZone: string = "Europe/Copenhagen"
): { date: string; minutesSinceMidnight: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesSinceMidnight =
    Number(parts.hour) * 60 + Number(parts.minute);
  return { date, minutesSinceMidnight };
}

/**
 * Parse en HH:MM- eller HH:MM:SS-streng til minutter siden midnat.
 * Returnerer null hvis input er ugyldig.
 */
export function parseDeadlineMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Returnerer true hvis check_in er i dag (Europe/Copenhagen) OG
 * aktuel tid har passeret deadline. Bookings til fremtidige datoer
 * berøres ikke. Null/ugyldig deadline = altid false.
 */
export function isPastSameDayDeadline(
  checkInIso: string,
  deadline: string | null | undefined,
  now: Date = new Date()
): boolean {
  const deadlineMinutes = parseDeadlineMinutes(deadline);
  if (deadlineMinutes === null) return false;
  const { date: today, minutesSinceMidnight } = getNowInTimeZone(now);
  if (checkInIso !== today) return false;
  return minutesSinceMidnight >= deadlineMinutes;
}

/**
 * Formaterer en TIME-streng ("17:00:00") som en kort dansk visning
 * ("kl. 17:00"). Bruges i fejlbeskeder og info-bannere.
 */
export function formatDeadlineLabel(value: string | null | undefined): string | null {
  const minutes = parseDeadlineMinutes(value);
  if (minutes === null) return null;
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `kl. ${h}:${m}`;
}
