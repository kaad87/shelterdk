import { describe, it, expect } from "vitest";
import {
  generateFilterPageFaq,
  generateRegionPageFaq,
  generateCrossPageFaq,
} from "../fakta-faq";

describe("fakta-faq", () => {
  it("generateFilterPageFaq returns 5 items with real numbers", () => {
    const items = generateFilterPageFaq("toilet", {
      totalCount: 312,
      topRegion: "Jylland",
      topRegionCount: 187,
      avgRating: 4.2,
      freeCount: 200,
      bookableCount: 95,
    });
    expect(items).toHaveLength(5);
    expect(items[0].answer).toContain("312");
    expect(items[1].answer).toContain("Jylland");
    expect(items.every((i) => i.question.length > 0 && i.answer.length > 0)).toBe(true);
  });

  it("generateRegionPageFaq returns 5 items with region name", () => {
    const items = generateRegionPageFaq("Jylland", "i", {
      totalCount: 623,
      freeCount: 412,
      facilityCounts: { toilet: 187, water: 203, baalplads: 156, hund: 100, strand: 80, bruser: 30, bookbar: 150, gratis: 412 },
      avgRating: 4.1,
      topShelterName: "Hald S\u00f8 Shelter",
    });
    expect(items).toHaveLength(5);
    expect(items[0].answer).toContain("623");
    expect(items[0].question).toContain("Jylland");
  });

  it("generateCrossPageFaq returns 4-5 items", () => {
    const items = generateCrossPageFaq("toilet", "Jylland", "i", {
      count: 187,
      avgRating: 4.3,
      freeCount: 120,
      topShelterName: "Skovly Shelter",
    });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items[0].answer).toContain("187");
  });
});
