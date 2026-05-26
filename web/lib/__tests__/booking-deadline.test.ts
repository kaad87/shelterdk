import { describe, it, expect } from "vitest";
import {
  formatDeadlineLabel,
  getNowInTimeZone,
  isPastSameDayDeadline,
  parseDeadlineMinutes,
} from "@/lib/booking-deadline";

describe("parseDeadlineMinutes", () => {
  it("parser HH:MM-format", () => {
    expect(parseDeadlineMinutes("17:00")).toBe(17 * 60);
    expect(parseDeadlineMinutes("00:00")).toBe(0);
    expect(parseDeadlineMinutes("23:59")).toBe(23 * 60 + 59);
  });
  it("parser Postgres TIME-format med sekunder", () => {
    expect(parseDeadlineMinutes("17:00:00")).toBe(17 * 60);
    expect(parseDeadlineMinutes("09:30:15")).toBe(9 * 60 + 30);
  });
  it("returnerer null for ugyldigt input", () => {
    expect(parseDeadlineMinutes(null)).toBeNull();
    expect(parseDeadlineMinutes(undefined)).toBeNull();
    expect(parseDeadlineMinutes("")).toBeNull();
    expect(parseDeadlineMinutes("24:00")).toBeNull();
    expect(parseDeadlineMinutes("17:60")).toBeNull();
    expect(parseDeadlineMinutes("17")).toBeNull();
    expect(parseDeadlineMinutes("morgen")).toBeNull();
  });
});

describe("getNowInTimeZone", () => {
  it("returnerer date + minutter for UTC-tidspunkt", () => {
    // 2026-06-15 14:30:00 UTC = 16:30 i Europe/Copenhagen (CEST, +2)
    const utc = new Date("2026-06-15T14:30:00Z");
    const { date, minutesSinceMidnight } = getNowInTimeZone(utc, "Europe/Copenhagen");
    expect(date).toBe("2026-06-15");
    expect(minutesSinceMidnight).toBe(16 * 60 + 30);
  });
  it("håndterer dato-rollover ved midnat lokal tid", () => {
    // 2026-06-15 23:30 UTC = 2026-06-16 01:30 i Copenhagen (CEST)
    const utc = new Date("2026-06-15T23:30:00Z");
    const { date, minutesSinceMidnight } = getNowInTimeZone(utc, "Europe/Copenhagen");
    expect(date).toBe("2026-06-16");
    expect(minutesSinceMidnight).toBe(1 * 60 + 30);
  });
  it("håndterer vintertid (CET, +1)", () => {
    // 2026-01-15 14:30 UTC = 15:30 i Copenhagen (CET)
    const utc = new Date("2026-01-15T14:30:00Z");
    const { minutesSinceMidnight } = getNowInTimeZone(utc, "Europe/Copenhagen");
    expect(minutesSinceMidnight).toBe(15 * 60 + 30);
  });
});

describe("isPastSameDayDeadline", () => {
  it("returnerer false når ingen deadline er sat", () => {
    const now = new Date("2026-06-15T20:00:00Z"); // 22:00 lokal
    expect(isPastSameDayDeadline("2026-06-15", null, now)).toBe(false);
    expect(isPastSameDayDeadline("2026-06-15", undefined, now)).toBe(false);
    expect(isPastSameDayDeadline("2026-06-15", "", now)).toBe(false);
  });
  it("returnerer false når check_in er en fremtidig dato", () => {
    const now = new Date("2026-06-15T20:00:00Z"); // 22:00 lokal — efter kl. 17 deadline
    expect(isPastSameDayDeadline("2026-06-16", "17:00", now)).toBe(false);
    expect(isPastSameDayDeadline("2026-07-01", "17:00", now)).toBe(false);
  });
  it("blokerer når aktuel tid er PRÆCIS deadline", () => {
    // 2026-06-15 15:00 UTC = 17:00 lokal (CEST)
    const now = new Date("2026-06-15T15:00:00Z");
    expect(isPastSameDayDeadline("2026-06-15", "17:00", now)).toBe(true);
  });
  it("blokerer når aktuel tid er efter deadline samme dag", () => {
    const now = new Date("2026-06-15T16:30:00Z"); // 18:30 lokal
    expect(isPastSameDayDeadline("2026-06-15", "17:00", now)).toBe(true);
  });
  it("tillader booking når aktuel tid er FØR deadline samme dag", () => {
    const now = new Date("2026-06-15T13:30:00Z"); // 15:30 lokal
    expect(isPastSameDayDeadline("2026-06-15", "17:00", now)).toBe(false);
  });
  it("respekterer Europe/Copenhagen midnat-rollover", () => {
    // 2026-06-15 23:30 UTC = 2026-06-16 01:30 lokal. Check_in 2026-06-16 — det
    // er "i dag" i lokal tid, og 01:30 < 17:00, så booking er tilladt.
    const now = new Date("2026-06-15T23:30:00Z");
    expect(isPastSameDayDeadline("2026-06-16", "17:00", now)).toBe(false);
    // Men check_in 2026-06-15 er nu "i går" lokalt — past-date er en separat
    // validering, men her returnerer vi false (deadline gælder kun samme dag).
    expect(isPastSameDayDeadline("2026-06-15", "17:00", now)).toBe(false);
  });
});

describe("formatDeadlineLabel", () => {
  it("formaterer som 'kl. HH:MM'", () => {
    expect(formatDeadlineLabel("17:00:00")).toBe("kl. 17:00");
    expect(formatDeadlineLabel("17:00")).toBe("kl. 17:00");
    expect(formatDeadlineLabel("09:30")).toBe("kl. 09:30");
  });
  it("returnerer null for ugyldigt input", () => {
    expect(formatDeadlineLabel(null)).toBeNull();
    expect(formatDeadlineLabel("ugyldig")).toBeNull();
  });
});
