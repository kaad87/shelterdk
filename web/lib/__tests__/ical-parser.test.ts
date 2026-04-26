import { describe, it, expect } from "vitest";
import { unfoldIcal, parseIcal } from "@/lib/ical-parser";

// ── unfoldIcal ──────────────────────────────────────────────────────────────

describe("unfoldIcal", () => {
  it("joins lines folded with CRLF + space", () => {
    // Fold happens after "Hello " — the CRLF+space is the fold indicator, leading space removed
    const raw = "SUMMARY:Hello \r\n World";
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
