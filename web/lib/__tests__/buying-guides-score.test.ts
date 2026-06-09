import { describe, it, expect } from "vitest";
import { scoreToStars, formatScore } from "@/lib/buying-guides-score";

describe("scoreToStars", () => {
  it("afrunder til nærmeste halve stjerne (0-5 skala fra 0-10 score)", () => {
    expect(scoreToStars(10)).toBe(5);
    expect(scoreToStars(9.0)).toBe(4.5);
    expect(scoreToStars(8.7)).toBe(4.5); // 4.35 -> 4.5
    expect(scoreToStars(8.2)).toBe(4); // 4.1 -> 4.0
    expect(scoreToStars(0)).toBe(0);
  });
  it("klamper til 0-5", () => {
    expect(scoreToStars(12)).toBe(5);
    expect(scoreToStars(-3)).toBe(0);
  });
});

describe("formatScore", () => {
  it("én decimal, dansk komma", () => {
    expect(formatScore(8.7)).toBe("8,7");
    expect(formatScore(9)).toBe("9,0");
  });
  it("null → tom streng", () => {
    expect(formatScore(null)).toBe("");
    expect(formatScore(undefined)).toBe("");
  });
});
