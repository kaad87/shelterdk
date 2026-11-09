import redirects from "@/data/municipality-by-redirects.json";

/**
 * Kommuner hvis kommuneside er en ren dublet af den tilsvarende /by/-side:
 * by-siden dækker præcis det samme shelter-sæt (se
 * shouldRedirectMunicipalityToByPage i lib/danmark-silo.ts), så autoriteten
 * samles på /by/<kommune> i stedet for at blive delt mellem to næsten ens sider.
 *
 * Listen er data (JSON), fordi den skal læses fra BÅDE next.config.js (CommonJS,
 * laver de rigtige 308-redirects) og app/sitemap.ts (udelukker de samme URL'er).
 * Ét sted at rette, ingen risiko for at redirect og sitemap siger noget forskelligt.
 *
 * Redirectet må IKKE ligge i selve kommunesiden: ruten er statisk prerendret, og
 * et permanentRedirect() under build bliver i Next 14 skrevet som en HTML-fil med
 * <meta http-equiv="refresh"> der udleveres med status 200 og kun layoutet. Det er
 * en soft-404 i Googles øjne. Se kommentaren i next.config.js.
 */
export interface MunicipalityByRedirect {
  /** Kommunens navn i DB (fx "Silkeborg"). */
  kommune: string;
  /** Regionens navn i DB (fx "Jylland"). */
  region: string;
  /** Kommunesidens path (fx "/danmark/jylland/silkeborg"). */
  from: string;
  /** By-sidens path (fx "/by/silkeborg"). */
  to: string;
}

export const MUNICIPALITY_BY_REDIRECTS: readonly MunicipalityByRedirect[] =
  redirects as MunicipalityByRedirect[];

/** Kommunenavne hvis kommuneside 308'er til en /by/-side (til sitemap-udelukkelse). */
export const REDIRECTING_MUNICIPALITY_NAMES: ReadonlySet<string> = new Set(
  MUNICIPALITY_BY_REDIRECTS.map((entry) => entry.kommune)
);

const REDIRECTING_MUNICIPALITY_PATHS: ReadonlyMap<string, string> = new Map(
  MUNICIPALITY_BY_REDIRECTS.map((entry) => [entry.from, entry.to])
);

/**
 * Kanonisk href til en kommuneside: `/by/<kommune>` for de kommuner hvis
 * kommuneside 308'er dertil, ellers stien uændret.
 *
 * Interne links skal pege direkte på målet. Ellers går hvert link gennem en
 * 308, og netop den side vi samler autoriteten på får ingen direkte interne
 * links — præcis samme grund som `canonicalRegionSlug` bruges i breadcrumbet
 * på shelter-detaljesiderne.
 *
 * Tager den færdigbyggede sti (fx "/danmark/jylland/silkeborg"), fordi
 * kaldestederne har regions- og kommunenavnet i forskellige former.
 */
export function canonicalMunicipalityHref(municipalityPath: string): string {
  return REDIRECTING_MUNICIPALITY_PATHS.get(municipalityPath) ?? municipalityPath;
}
