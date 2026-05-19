import { describe, expect, it } from "vitest";
import {
  extractNaturstyrelsenPid,
  normalizeNaturstyrelsenAvailabilityPayload,
} from "../naturstyrelsen-availability";

describe("extractNaturstyrelsenPid", () => {
  it("finder PID i hidden input", () => {
    const html = '<input type="hidden" name="PID" value="235" />';
    expect(extractNaturstyrelsenPid(html)).toBe("235");
  });

  it("finder PID i JS-konfiguration", () => {
    const html = "var bookingConfig = { PID: 7812, title: 'Test' };";
    expect(extractNaturstyrelsenPid(html)).toBe("7812");
  });

  it("returnerer null når PID mangler", () => {
    expect(extractNaturstyrelsenPid("<html>ingen pid her</html>")).toBeNull();
  });
});

describe("normalizeNaturstyrelsenAvailabilityPayload", () => {
  it("normaliserer bookede og delvist bookede datoer", () => {
    expect(
      normalizeNaturstyrelsenAvailabilityPayload({
        BookingDates: ["2026-05-14", "2026-05-15"],
        PartialBookingDates: ["2026-05-16"],
      })
    ).toEqual([
      { day: "2026-05-14", state: "booked" },
      { day: "2026-05-15", state: "booked" },
      { day: "2026-05-16", state: "partial" },
    ]);
  });

  it("lader booked vinde over partial på samme dato", () => {
    expect(
      normalizeNaturstyrelsenAvailabilityPayload({
        BookingDates: ["2026-05-14"],
        PartialBookingDates: ["2026-05-14"],
      })
    ).toEqual([{ day: "2026-05-14", state: "booked" }]);
  });

  it("ignorerer ugyldige værdier", () => {
    expect(
      normalizeNaturstyrelsenAvailabilityPayload({
        BookingDates: ["2026-05-14", "ikke-en-dato", 123 as unknown as string],
        PartialBookingDates: null as unknown as string[],
      })
    ).toEqual([{ day: "2026-05-14", state: "booked" }]);
  });
});

