import { describe, it, expect } from "vitest";
import {
  generateFilterPageFaq,
  generateRegionPageFaq,
  generateCrossPageFaq,
} from "../fakta-faq";

describe("fakta-faq", () => {
  it("generateFilterPageFaq returns 4 items with real numbers", () => {
    // Was 5 \u2014 "Er shelters med X gratis?" droppet fordi payment-data
    // er for up\u00e5lideligt til at vises som tal.
    const items = generateFilterPageFaq("toilet", {
      totalCount: 312,
      topRegion: "Jylland",
      topRegionCount: 187,
      avgRating: 4.2,
      freeCount: 200,
      bookableCount: 95,
    });
    expect(items).toHaveLength(4);
    expect(items[0].answer).toContain("312");
    expect(items[1].answer).toContain("Jylland");
    expect(items.every((i) => i.question.length > 0 && i.answer.length > 0)).toBe(true);
    expect(items.some((i) => i.question.toLowerCase().includes("gratis"))).toBe(false);
  });

  it("generateRegionPageFaq returns 4 items with region name", () => {
    // Was 5 \u2014 "Er der gratis shelters?" droppet (samme begrundelse).
    const items = generateRegionPageFaq("Jylland", "i", {
      totalCount: 623,
      freeCount: 412,
      facilityCounts: { toilet: 187, water: 203, baalplads: 156, hund: 100, strand: 80, bruser: 30, bookbar: 150, gratis: 412 },
      avgRating: 4.1,
      topShelterName: "Hald S\u00f8 Shelter",
    });
    expect(items).toHaveLength(4);
    expect(items[0].answer).toContain("623");
    expect(items[0].question).toContain("Jylland");
    expect(items.some((i) => i.question.toLowerCase().includes("gratis"))).toBe(false);
  });

  it("generateCrossPageFaq returns 3-4 items", () => {
    // Was 4-5 \u2014 "Er X gratis?" droppet (samme begrundelse).
    const items = generateCrossPageFaq("toilet", "Jylland", "i", {
      count: 187,
      avgRating: 4.3,
      freeCount: 120,
      topShelterName: "Skovly Shelter",
    });
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].answer).toContain("187");
    expect(items.some((i) => i.question.toLowerCase().includes("gratis"))).toBe(false);
  });
});
