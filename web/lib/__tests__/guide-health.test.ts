import { describe, it, expect } from "vitest";
import { guideHealth, type HealthInput } from "@/lib/guide-health";

const NOW = new Date("2026-09-21T12:00:00Z");
const base: HealthInput = {
  slug: "telt",
  lastReviewedAt: "2026-09-01",
  entries: [
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: "Vores valg" },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null },
  ],
};

describe("guideHealth", () => {
  it("melder alt godt når produkterne er på lager og gennemgangen er frisk", () => {
    const h = guideHealth(base, NOW);
    expect(h.dead).toBe(0);
    expect(h.problems).toEqual([]);
  });

  it("tæller udsolgte og blokerede som døde", () => {
    const h = guideHealth({ ...base, entries: [
      { inStock: false, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null },
      { inStock: true, isBlocked: true, lastSeenAt: "2026-09-21", awardLabel: null },
      ...base.entries.slice(2),
    ] }, NOW);
    expect(h.dead).toBe(2);
  });

  it("advarer når guiden har under fire produkter der kan købes", () => {
    const h = guideHealth({ ...base, entries: base.entries.map((e, i) => (i < 2 ? { ...e, inStock: false } : e)) }, NOW);
    expect(h.problems).toContain("kun 2 produkter kan købes");
  });

  it("advarer om produkter der har været ude af feedet længe", () => {
    const h = guideHealth({ ...base, entries: [{ ...base.entries[0], inStock: false, lastSeenAt: "2026-04-12" }, ...base.entries.slice(1)] }, NOW);
    expect(h.problems.some((p) => /afmeldt/.test(p))).toBe(true);
  });

  it("advarer når gennemgangen er over 120 dage gammel", () => {
    const h = guideHealth({ ...base, lastReviewedAt: "2026-04-01" }, NOW);
    expect(h.problems.some((p) => /gennemgået/.test(p))).toBe(true);
  });

  it("advarer når et udsolgt produkt stadig bærer et prædikat i basen", () => {
    const h = guideHealth({ ...base, entries: [{ ...base.entries[0], inStock: false }, ...base.entries.slice(1)] }, NOW);
    expect(h.problems.some((p) => /prædikat/.test(p))).toBe(true);
  });
});
