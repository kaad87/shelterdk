import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..", "..");

/**
 * /danmark/<ukendt-region> svarede 200 med kun layoutet (ingen <h1>) i stedet
 * for 404 — en soft-404 for Google. Aarsagen var en route-level loading.tsx i
 * segmentet: den laegger en Suspense-graense om siden, saa svaret var begyndt
 * at streame naar page.tsx kaldte notFound(), og Next kunne ikke saette status.
 *
 * `dynamicParams = false` raekker ikke som vaern: siden laeser searchParams og
 * er derfor ikke ren statisk, saa den renderes for enhver slug.
 *
 * Maalt mod next build + next start: med loading.tsx → 200, uden → 404.
 */
describe("region-ruten maa ikke faa en route-level loading.tsx igen", () => {
  it("har ingen loading.tsx i [region]-segmentet", () => {
    const loading = path.join(WEB_ROOT, "app/(site)/danmark/[region]/loading.tsx");
    expect(
      existsSync(loading),
      "En loading.tsx her gor /danmark/<ukendt-region> til en 200 soft-404 igen. " +
        "Vil du have et skeleton, saa laeg Suspense INDE i page.tsx omkring det " +
        "tunge indhold — efter notFound()-tjekket — ikke som route-level loading.tsx."
    ).toBe(false);
  });

  it("validerer stadig region-slug'en med notFound() i page.tsx", () => {
    // Valideringen maa ligge i page.tsx, ikke i et layout: maalt gav notFound()
    // fra et layout korrekt 404, men en helt tom 404-side.
    const page = path.join(WEB_ROOT, "app/(site)/danmark/[region]/page.tsx");
    const source = require("node:fs").readFileSync(page, "utf8");
    expect(source).toMatch(/if\s*\(!regionName\)\s*notFound\(\)/);
  });
});
