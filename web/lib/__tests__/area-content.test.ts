import { describe, expect, it } from "vitest";
import { AREA_CONTENT, GUDENAA_RUTER, getAreaContent, samlesideForRute } from "../area-content";
import { ruteShelterIds } from "../collection-pages";
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

  it("sender rutesiderne til den rigtige samleside", () => {
    expect(samlesideForRute("haervejen")).toEqual({ href: "/omraade/haervejen", navn: "Hærvejen" });
    for (const r of ["etape-10-gudenaastien", "gudenaastien-nordsiden", "traekstien-mellem-randers-og-silkeborg"]) {
      expect(samlesideForRute(r)?.href, r).toBe("/gudenaaen");
    }
    // Ingen samleside: rutesiden beholder sin egen overskrift.
    expect(samlesideForRute("moen-rundt")).toBeNull();
    // Hærvejens etaper og varianter er ikke selve Hærvejen.
    expect(samlesideForRute("haervejen-etape-3")).toBeNull();
  });

  it("finder Gudenå-rutepladserne i ruteplannerens data", () => {
    // 33 unikke pladser paa 12 ruter den 19/11 2026. Graensen er lav med
    // vilje: testen skal fange en tom fil eller et brudt moenster, ikke at
    // ruteplanneren faar en plads mere eller mindre.
    expect(ruteShelterIds(GUDENAA_RUTER).length).toBeGreaterThan(20);
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
