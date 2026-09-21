import { describe, it, expect } from "vitest";
import { COLLECTIONS } from "@/lib/collection-pages";

describe("bålhytte-samlesiden", () => {
  it("har en købs-sektion — halvdelen af søgningerne er pris/tilbud-intent", () => {
    const sections = COLLECTIONS.baalhytte.sections ?? [];
    const buy = sections.find((s) => /køb/i.test(s.heading));
    expect(buy).toBeDefined();
    expect(buy!.paragraphs.join(" ")).toMatch(/kr/);
    expect(buy!.links?.some((l) => l.href.includes("naturstyrelsen.dk"))).toBe(true);
  });
});
