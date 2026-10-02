import { describe, it, expect } from "vitest";
import { getBlogPosts } from "@shared/data/blog";

describe("blogindlæggenes svarkapsler", () => {
  const withAnswer = getBlogPosts().filter((p) => p.quickAnswer);

  it("findes på de indlæg der fanger spørgsmåls-søgninger", () => {
    const slugs = withAnswer.map((p) => p.slug);
    expect(slugs).toContain("shelter-vs-teltplads");
    expect(slugs).toContain("gratis-shelters-i-danmark");
  });

  it("er korte nok til at blive citeret og indeholder ingen links", () => {
    for (const p of withAnswer) {
      expect(p.quickAnswer!.length, p.slug).toBeLessThanOrEqual(420);
      expect(p.quickAnswer!.length, p.slug).toBeGreaterThan(80);
      expect(p.quickAnswer!, p.slug).not.toMatch(/\[|\]\(|https?:\/\//);
    }
  });
});
