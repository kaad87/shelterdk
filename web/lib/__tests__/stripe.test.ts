import { describe, it, expect } from "vitest";
import { calculateFee } from "@/lib/stripe";

describe("calculateFee", () => {
  it("free shelter: guest pays minimum fee only", () => {
    expect(calculateFee(0, 5, 25)).toEqual({
      shelterDkk: 0, platformDkk: 25, totalDkk: 25,
    });
  });

  it("cheap shelter: minimum beats percentage (100 kr × 5% = 5 < 25)", () => {
    expect(calculateFee(100, 5, 25)).toEqual({
      shelterDkk: 100, platformDkk: 25, totalDkk: 125,
    });
  });

  it("expensive shelter: percentage beats minimum (600 kr × 5% = 30 > 25)", () => {
    expect(calculateFee(600, 5, 25)).toEqual({
      shelterDkk: 600, platformDkk: 30, totalDkk: 630,
    });
  });

  it("exact crossover: percentage equals minimum (500 kr × 5% = 25)", () => {
    expect(calculateFee(500, 5, 25)).toEqual({
      shelterDkk: 500, platformDkk: 25, totalDkk: 525,
    });
  });

  it("rounds platform fee to whole DKK (333 kr × 5% = 16.65 → 17)", () => {
    expect(calculateFee(333, 5, 0)).toEqual({
      shelterDkk: 333, platformDkk: 17, totalDkk: 350,
    });
  });

  it("zero minimum: only percentage applies", () => {
    expect(calculateFee(200, 10, 0)).toEqual({
      shelterDkk: 200, platformDkk: 20, totalDkk: 220,
    });
  });
});
