import { describe, it, expect } from "vitest";
import { haversineKm, formatDistance, formatWalkingTime, estimateWalkingHours } from "@/lib/haversine";

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(56.0, 10.0, 56.0, 10.0)).toBe(0);
  });
  it("calculates Copenhagen to Aarhus ~187 km", () => {
    const d = haversineKm(55.6761, 12.5683, 56.1629, 10.2039);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(170);
  });
  it("calculates short distance accurately", () => {
    const d = haversineKm(56.0, 10.0, 56.01, 10.0);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});

describe("formatDistance", () => {
  it("formats km values", () => {
    expect(formatDistance(12.34)).toBe("12.3 km");
    expect(formatDistance(1.0)).toBe("1.0 km");
  });
  it("formats sub-km as meters", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(0.1)).toBe("100 m");
  });
});

describe("formatWalkingTime", () => {
  it("formats hours", () => {
    expect(formatWalkingTime(4.2)).toBe("~4.2 t");
  });
  it("formats sub-hour as minutes", () => {
    expect(formatWalkingTime(0.5)).toBe("~30 min");
  });
});

describe("estimateWalkingHours", () => {
  it("estimates at 5 km/h", () => {
    expect(estimateWalkingHours(10)).toBe(2);
    expect(estimateWalkingHours(25)).toBe(5);
  });
});
