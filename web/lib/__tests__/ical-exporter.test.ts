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
    guest_token: "00000000-0000-0000-0000-000000000001",
    cancelled_at: null,
    cancelled_by: null,
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
