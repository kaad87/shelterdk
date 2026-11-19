import { describe, expect, it } from "vitest";
import { AREA_CONTENT, RUTE_SAMLESIDE, getAreaContent } from "../area-content";
import { getAreaFaqItems } from "../faq";

describe("area-content", () => {
  it("giver Hærvejen sine egne spoergsmaal og pakkeliste", () => {
    const c = getAreaContent("haervejen");
    expect(c?.faq.length).toBeGreaterThan(0);
    expect(c?.sections?.[0].heading).toBe("Pakkeliste til Hærvejen");
    expect(getAreaContent("bornholm")).toBeNull();
  });

  it("stiller ikke skabelonens spoergsmaal, som omraadet selv svarer paa", () => {
    const c = getAreaContent("haervejen")!;
    const skabelon = getAreaFaqItems("Hærvejen", "langs", c.faqErstatter);
    expect(skabelon.map((f) => f.question)).toEqual([
      "Hvilke faciliteter har shelters langs Hærvejen?",
      "Må man tænde bål ved shelters langs Hærvejen?",
    ]);
    // Uden udelad er skabelonen uaendret: fire spoergsmaal.
    expect(getAreaFaqItems("Bornholm", "på")).toHaveLength(4);
  });

  it("linker aldrig til /haervejen, som nu er en redirect", () => {
    const hrefs = Object.values(AREA_CONTENT).flatMap((c) => [
      ...(c.related ?? []).map((r) => r.href),
      ...(c.sections ?? []).flatMap((s) => (s.links ?? []).map((l) => l.href)),
    ]);
    expect(hrefs).not.toContain("/haervejen");
  });

  it("peger rutesiden paa en omraadeside, der har indhold", () => {
    for (const { href } of Object.values(RUTE_SAMLESIDE)) {
      const m = href.match(/^\/omraade\/(.+)$/);
      expect(m, href).not.toBeNull();
      expect(getAreaContent(m![1]), href).not.toBeNull();
    }
  });

  it("redirecter /haervejen permanent til samlesiden", async () => {
    const nextConfig = (await import("../../next.config.js")).default;
    const redirects: { source: string; destination: string; permanent: boolean }[] =
      await nextConfig.redirects();
    expect(redirects).toContainEqual({
      source: "/haervejen",
      destination: "/omraade/haervejen",
      permanent: true,
    });
  });
});
