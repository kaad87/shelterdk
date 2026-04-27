import { describe, it, expect } from "vitest";
import { isRefundEligible } from "@/lib/booking-db";

describe("isRefundEligible", () => {
  it("returns true when check_in is more than cutoff hours away", () => {
    // check_in midnight UTC on Jun 1 = 2026-06-01T00:00:00Z
    // now = May 28 12:00 UTC → 84 hours away → > 48h cutoff
    const now = new Date("2026-05-28T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(true);
  });

  it("returns false when check_in is less than cutoff hours away", () => {
    // now = May 31 12:00 UTC → 12 hours away → < 48h cutoff
    const now = new Date("2026-05-31T12:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("returns false when exactly at cutoff (strictly greater required)", () => {
    // now = May 30 00:00 UTC → exactly 48 hours to Jun 1 midnight UTC
    const now = new Date("2026-05-30T00:00:00Z");
    expect(isRefundEligible("2026-06-01", 48, now)).toBe(false);
  });

  it("handles 168h (7 days) cutoff", () => {
    const now = new Date("2026-05-20T00:00:00Z"); // 12 days before Jun 1
    expect(isRefundEligible("2026-06-01", 168, now)).toBe(true);
  });

  it("handles 24h cutoff where just outside", () => {
    const now = new Date("2026-05-30T20:00:00Z"); // ~28h before Jun 1 midnight UTC
    expect(isRefundEligible("2026-06-01", 24, now)).toBe(true);
  });
});
