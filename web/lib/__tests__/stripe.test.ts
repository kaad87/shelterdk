import { describe, it, expect } from "vitest";
import {
  calculateFee,
  calculateBookingAmounts,
  calculateBookingNights,
  calculateVatIncludedBreakdown,
} from "@/lib/stripe";

describe("calculateFee", () => {
  it("free shelter: guest pays minimum fee only", () => {
    expect(calculateFee(0, 5, 25)).toEqual({
      shelterDkk: 0, platformDkk: 25, platformNetDkk: 20, platformVatDkk: 5, totalDkk: 25,
    });
  });

  it("cheap shelter: minimum beats percentage (100 kr × 5% = 5 < 25)", () => {
    expect(calculateFee(100, 5, 25)).toEqual({
      shelterDkk: 100, platformDkk: 25, platformNetDkk: 20, platformVatDkk: 5, totalDkk: 125,
    });
  });

  it("expensive shelter: percentage beats minimum (600 kr × 5% = 30 > 25)", () => {
    expect(calculateFee(600, 5, 25)).toEqual({
      shelterDkk: 600, platformDkk: 30, platformNetDkk: 24, platformVatDkk: 6, totalDkk: 630,
    });
  });

  it("exact crossover: percentage equals minimum (500 kr × 5% = 25)", () => {
    expect(calculateFee(500, 5, 25)).toEqual({
      shelterDkk: 500, platformDkk: 25, platformNetDkk: 20, platformVatDkk: 5, totalDkk: 525,
    });
  });

  it("rounds platform fee to whole DKK (333 kr × 5% = 16.65 → 17)", () => {
    expect(calculateFee(333, 5, 0)).toEqual({
      shelterDkk: 333, platformDkk: 17, platformNetDkk: 13.6, platformVatDkk: 3.4, totalDkk: 350,
    });
  });

  it("zero minimum: only percentage applies", () => {
    expect(calculateFee(200, 10, 0)).toEqual({
      shelterDkk: 200, platformDkk: 20, platformNetDkk: 16, platformVatDkk: 4, totalDkk: 220,
    });
  });
});

describe("calculateVatIncludedBreakdown", () => {
  it("splits 50 kr gross into 40 kr net and 10 kr VAT", () => {
    expect(calculateVatIncludedBreakdown(50)).toEqual({
      grossDkk: 50,
      netDkk: 40,
      vatDkk: 10,
    });
  });
});

describe("calculateBookingNights", () => {
  it("returns the number of nights between check-in and check-out", () => {
    expect(calculateBookingNights("2027-06-01", "2027-06-04")).toBe(3);
  });
});

describe("calculateBookingAmounts", () => {
  it("multiplies shelter price by nights before platform fee is added", () => {
    expect(
      calculateBookingAmounts({
        checkIn: "2027-06-01",
        checkOut: "2027-06-04",
        shelterPriceDkk: 100,
        feePct: 5,
        feeMinDkk: 25,
      })
    ).toEqual({
      nights: 3,
      shelterDkk: 300,
      platformDkk: 25,
      platformNetDkk: 20,
      platformVatDkk: 5,
      totalDkk: 325,
    });
  });
});
