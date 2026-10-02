import { describe, it, expect } from "vitest";
import { buyingGuideLines, themeLines, type GuideLine } from "@/lib/llms-sections";

const guides: GuideLine[] = [
  { slug: "sovepose", title: "Bedste sovepose 2026", buyable: 6, minPrice: 449, maxPrice: 2852, winner: "Snugpak Travelpak 3" },
  { slug: "telt", title: "Bedste telt 2026", buyable: 4, minPrice: 549, maxPrice: 1299, winner: null },
  { slug: "tom", title: "Bedste tom 2026", buyable: 0, minPrice: null, maxPrice: null, winner: null },
];

describe("buyingGuideLines", () => {
  it("udelader guider uden produkter der kan købes", () => {
    expect(buyingGuideLines(guides).join("\n")).not.toMatch(/\/bedste\/tom/);
  });

  it("angiver antal, prisspænd og førstevalg så en assistent kan citere tal", () => {
    const l = buyingGuideLines(guides)[0];
    expect(l).toContain("https://shelterdk.dk/bedste/sovepose");
    expect(l).toContain("6 produkter");
    expect(l).toContain("449");
    expect(l).toContain("2.852");
    expect(l).toContain("Snugpak Travelpak 3");
  });

  it("udelader førstevalget når ingen er udpeget", () => {
    const l = buyingGuideLines(guides)[1];
    expect(l).toContain("4 produkter");
    expect(l).not.toContain("Førstevalg");
  });

  it("sorterer alfabetisk på slug så filen er stabil mellem kørsler", () => {
    const out = buyingGuideLines([guides[1], guides[0]]);
    expect(out[0]).toContain("/bedste/sovepose");
  });
});

describe("themeLines", () => {
  it("indeholder de temasider der mangler i dag", () => {
    const t = themeLines({ friTeltning: 313, teltplads: 275, baalhytte: 10 }).join("\n");
    expect(t).toContain("/fri-teltning");
    expect(t).toContain("313");
    expect(t).toContain("/teltplads");
    expect(t).toContain("/baalhytte");
    expect(t).toContain("/koeb-shelter");
    expect(t).toContain("/tilbud");
  });
});
