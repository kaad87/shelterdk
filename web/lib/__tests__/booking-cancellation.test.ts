import { describe, it, expect } from "vitest";
import { isRefundEligible } from "@/lib/booking-db";

describe("isRefundEligible", () => {
  it("returns true when check_in is more than cutoff hours away", () => {
    // check_in midnight Copenhagen on Jun 1 summer time = 2026-05-31T22:00:00Z
    // now = May 28 12:00 UTC → 82 hours away → > 48h cutoff
    const now = new Date("2026-05-28T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(true);
  });

  it("returns false when check_in is less than cutoff hours away", () => {
    // now = May 31 12:00 UTC → 10 hours away → < 48h cutoff
    const now = new Date("2026-05-31T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("returns false when exactly at cutoff (strictly greater required)", () => {
    // now = May 29 22:00 UTC → exactly 48 hours to Jun 1 midnight Copenhagen
    const now = new Date("2026-05-29T22:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("handles 168h (7 days) cutoff", () => {
    const now = new Date("2026-05-20T00:00:00Z"); // 12 days before Jun 1
    expect(isRefundEligible("2026-06-01", 168, now)).toBe(true);
  });

  it("handles 24h cutoff where just outside", () => {
    const now = new Date("2026-05-30T20:00:00Z"); // 26h before Jun 1 midnight Copenhagen
    expect(isRefundEligible("2026-06-01", 24, now)).toBe(true);
  });

  it("respects Danish summer time instead of raw server UTC midnight", () => {
    // Copenhagen midnight on Jul 1 is 2026-06-30T22:00:00Z.
    // At 2026-06-29T22:30:00Z there are only 23.5h left to the local cutoff.
    const now = new Date("2026-06-29T22:30:00Z");
    expect(isRefundEligible("2026-07-01", 24, now)).toBe(false);
  });
});
