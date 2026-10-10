import { describe, it, expect } from "vitest";
import { contrastRatio, CTA_BG, CTA_FG } from "@/lib/cta-contrast";

describe("affiliate-CTA'ens kontrast", () => {
  it("består WCAG AA for normal tekst", () => {
    expect(contrastRatio(CTA_BG, CTA_FG)).toBeGreaterThanOrEqual(4.5);
  });

  it("fanger den oprindelige guld-på-hvid, som ikke bestod", () => {
    expect(contrastRatio("#C5A059", "#FFFFFF")).toBeLessThan(4.5);
  });

  it("regner kendte forhold korrekt", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#2C3E50", "#FFFFFF")).toBeCloseTo(10.98, 1);
  });
});
