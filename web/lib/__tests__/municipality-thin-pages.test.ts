import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..", "..");
const MUNICIPALITY_PAGE = path.join(
  WEB_ROOT,
  "app/(site)/danmark/[region]/[municipality]/page.tsx"
);
const SITEMAP = path.join(WEB_ROOT, "app/sitemap.ts");
const FRI_TELTNING = path.join(WEB_ROOT, "app/(site)/fri-teltning/page.tsx");

const read = (p: string) => readFileSync(p, "utf8");
/** Fjerner kommentarer, saa vi ikke matcher vores egen begrundelsestekst. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * Kommuner med kun 1 shelter gav 404: generateStaticParams byggede sine params
 * af getRegionKommunePairs(2), og ruten har dynamicParams = false. Men shelter-
 * sidens breadcrumb, region-hubben og /fri-teltning linkede derhen alligevel,
 * saa baade brugere og Google ramte en blindgyde (5 kommuner maalt 9/11 2026).
 *
 * Loesningen er at SERVERE fra 1 og INDEKSERE fra 2 — ikke at fjerne linkene,
 * for saa kan man slet ikke navigere til shelteret.
 */
describe("kommunesiden serveres fra 1 shelter, men indekseres fra 2", () => {
  it("bygger params fra side-taersklen, og den er 1", () => {
    const source = stripComments(read(MUNICIPALITY_PAGE));
    expect(source).toMatch(
      /generateStaticParams\(\)\s*\{\s*const pairs = await getRegionKommunePairs\(MIN_SHELTERE_FOR_SIDE\)/
    );
    expect(source).toMatch(/const MIN_SHELTERE_FOR_SIDE = 1;/);
  });

  it("noindexer alt under indekserings-taersklen, og den er 2", () => {
    const source = stripComments(read(MUNICIPALITY_PAGE));
    expect(source).toMatch(/const MIN_SHELTERE_FOR_INDEKSERING = 2;/);
    expect(source).toMatch(
      /shelters\.length < MIN_SHELTERE_FOR_INDEKSERING && \{\s*robots: \{ index: false, follow: true \}/
    );
  });

  it("kan resolve kommunenavnet for de tynde kommuner", () => {
    // Med taerskel 2 her returnerede navneopslaget null for en 1-shelter-
    // kommune, og siden kaldte notFound() selv om params var genereret.
    const source = stripComments(read(MUNICIPALITY_PAGE));
    expect(source).not.toMatch(/getMunicipalitiesInRegion\(regionName, 2\)/);
    const hits = source.match(
      /getMunicipalitiesInRegion\(regionName, MIN_SHELTERE_FOR_SIDE\)/g
    );
    expect(hits, "baade generateMetadata og page-komponenten skal bruge den").toHaveLength(2);
  });

  it("holder sitemappets taerskel uafhaengig paa 2", () => {
    // Sitemappet maa IKKE arve side-taersklen: saa ville de tynde sider blive
    // indsendt til Google, hvilket er praecis det noindex skal forhindre.
    const source = stripComments(read(SITEMAP));
    expect(source).toMatch(/getRegionKommunePairs\(2\)/);
  });
});

/**
 * /fri-teltning grupperer sine omraader efter sit eget region-felt og byggede
 * kommune-linket af gruppens region. Det gav stier der ikke findes, fordi
 * datasaettets gruppering ikke er shelter-tabellens (region, kommune)-par:
 * /danmark/sjaelland-og-oeerne/bornholm og .../koebenhavn gav 404 (maalt
 * 9/11 2026), for de to kommuner hoerer under andre regioner i siloen.
 */
describe("/fri-teltning linker ikke kommuner til en fremmed region", () => {
  it("bygger ikke stien af gruppens region", () => {
    const source = stripComments(read(FRI_TELTNING));
    expect(
      source,
      "gruppens region passer ikke altid med kommunens region i siloen"
    ).not.toMatch(/slugifySegment\(region\)\}\/\$\{slugifySegment\(a\.kommune\)/);
  });

  it("slaar kommunens faktiske region op i siloen", () => {
    const source = stripComments(read(FRI_TELTNING));
    expect(source).toMatch(/getRegionKommunePairs\(1\)/);
    expect(source).toMatch(/regionSlugByKommune/);
  });

  it("falder tilbage til by-siden naar der ikke er nogen kommuneside", () => {
    // Koebenhavn har ingen shelters paa kommune-niveau, men /by/koebenhavn er
    // en levende side. Uden fald-tilbage mistede /fri-teltning det link.
    const source = stripComments(read(FRI_TELTNING));
    expect(source).toMatch(/getDistinctByLandingPages\(1\)/);
    expect(source).toMatch(/byPageSlugs\.has\(kommuneSlug\)/);
  });

  it("udelader linket naar hverken kommuneside eller by-side findes", () => {
    // Returnerer helperen null, maa der ikke renderes et <Link> alligevel.
    const source = stripComments(read(FRI_TELTNING));
    expect(source).toMatch(/return null;\s*\}/);
    expect(source).toMatch(/\{kommuneHref && \(/);
  });
});
