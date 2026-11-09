import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MUNICIPALITY_BY_REDIRECTS,
  REDIRECTING_MUNICIPALITY_NAMES,
  canonicalMunicipalityHref,
} from "@/lib/municipality-by-redirects";
import { PRIORITY_BY_CITY_NAMES } from "@/lib/danmark-silo";
import { slugifySegment } from "@/lib/slug";

const REPO_WEB_ROOT = path.resolve(__dirname, "..", "..");

describe("municipality → /by redirect-listen", () => {
  it("har paths der matcher kommune- og regionsnavnene", () => {
    for (const { kommune, region, from, to } of MUNICIPALITY_BY_REDIRECTS) {
      expect(from).toBe(`/danmark/${slugifySegment(region)}/${slugifySegment(kommune)}`);
      expect(to).toBe(`/by/${slugifySegment(kommune)}`);
    }
  });

  it("indeholder kun priority-byer (de eneste shouldRedirectMunicipalityToByPage kan sige ja til)", () => {
    const priority = new Set<string>(PRIORITY_BY_CITY_NAMES);
    for (const { kommune } of MUNICIPALITY_BY_REDIRECTS) {
      expect(priority.has(kommune), `${kommune} er ikke en priority-by`).toBe(true);
    }
  });

  it("har ingen dubletter", () => {
    const froms = MUNICIPALITY_BY_REDIRECTS.map((entry) => entry.from);
    expect(new Set(froms).size).toBe(froms.length);
    expect(REDIRECTING_MUNICIPALITY_NAMES.size).toBe(MUNICIPALITY_BY_REDIRECTS.length);
  });
});

describe("kommunesiden må ikke redirecte i render", () => {
  // Ruten er statisk prerendret. Et redirect() under build bliver i Next 14 en
  // <meta http-equiv="refresh">-side udleveret med status 200 og kun layoutet —
  // altså en soft-404 for Google. Redirectene hører i next.config.js.
  it("importerer ikke redirect/permanentRedirect i page.tsx", () => {
    const source = readFileSync(
      path.join(REPO_WEB_ROOT, "app/(site)/danmark/[region]/[municipality]/page.tsx"),
      "utf8"
    );
    const code = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const navImport = code.match(/import\s*\{([^}]*)\}\s*from\s*"next\/navigation"/);
    expect(navImport, 'forventede et import fra "next/navigation"').not.toBeNull();
    const imported = navImport![1].split(",").map((name) => name.trim());
    expect(imported).not.toContain("redirect");
    expect(imported).not.toContain("permanentRedirect");
    expect(code).not.toMatch(/\bpermanentRedirect\s*\(/);
  });

  it("er dækket af eksakte 308-redirects i next.config.js", async () => {
    const nextConfig = require(path.join(REPO_WEB_ROOT, "next.config.js"));
    const redirects: { source: string; destination: string; permanent: boolean }[] =
      await nextConfig.redirects();
    const bySource = new Map(redirects.map((r) => [r.source, r]));

    for (const { from, to } of MUNICIPALITY_BY_REDIRECTS) {
      const rule = bySource.get(from);
      expect(rule, `mangler redirect for ${from}`).toBeDefined();
      expect(rule!.destination).toBe(to);
      expect(rule!.permanent).toBe(true);
      // Eksakt path: et wildcard ville også ramme shelter-detaljesiderne under
      // /danmark/:region/:kommune/:slug.
      expect(rule!.source).not.toMatch(/[:*]/);
    }
  });
});

describe("canonicalMunicipalityHref", () => {
  it("peger de redirectende kommunesider direkte paa /by/<kommune>", () => {
    for (const { from, to } of MUNICIPALITY_BY_REDIRECTS) {
      expect(canonicalMunicipalityHref(from)).toBe(to);
    }
  });

  it("lader almindelige kommunesider vaere i fred", () => {
    expect(canonicalMunicipalityHref("/danmark/fyn/assens")).toBe("/danmark/fyn/assens");
    expect(canonicalMunicipalityHref("/danmark/bornholm/roenne")).toBe("/danmark/bornholm/roenne");
    // Shelter-detaljesider er tre segmenter og maa aldrig omskrives.
    expect(canonicalMunicipalityHref("/danmark/jylland/silkeborg/et-shelter-123")).toBe(
      "/danmark/jylland/silkeborg/et-shelter-123"
    );
  });

  // Hvert sted der bygger et link til en kommuneside skal gaa gennem helperen,
  // ellers peger linket paa en 308 og by-siden faar ingen direkte interne links.
  it("bruges paa alle kendte kaldesteder der linker til en kommuneside", () => {
    const callSites = [
      "app/(site)/danmark/[region]/[municipality]/[shelter_slug]/page.tsx",
      "app/(site)/by/[by_slug]/page.tsx",
      "app/(site)/danmark/[region]/page.tsx",
      "app/(site)/fri-teltning/page.tsx",
      "app/(site)/omraade/[slug]/page.tsx",
      "components/CrossFilterRegionPage.tsx",
    ];
    for (const rel of callSites) {
      const source = readFileSync(path.join(REPO_WEB_ROOT, rel), "utf8");
      expect(source, `${rel} linker til en kommuneside uden canonicalMunicipalityHref`).toContain(
        "canonicalMunicipalityHref("
      );
    }
  });
});
