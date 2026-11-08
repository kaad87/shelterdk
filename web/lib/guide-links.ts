import { createPublicClient } from "@/utils/supabase/server-public";

export interface GuideLink {
  slug: string;
  title: string;
  /** Hvorfor netop denne guide er relevant netop her. */
  reason: string;
}

/** Hvor i sitet linket staar. Foelger med ind i affiliate_clicks.path. */
export type GuideKilde = "shelter" | "forside" | "by" | "omraade" | "tema" | "hub";

const KILDER: readonly GuideKilde[] = [
  "shelter",
  "forside",
  "by",
  "omraade",
  "tema",
  "hub",
];

/**
 * Link til en koebsguide, maerket med hvilken sidetype klikket kom fra.
 *
 * `?fra=` foelger med ind i `affiliate_clicks.path`, saa et koeb kan henfoeres
 * til den tragt det kom gennem uden ny infrastruktur. Guidens canonical peger
 * paa den rene URL (bedste/[slug]/page.tsx), og siden laeser ikke selv
 * searchParams, saa parameteren skaber hverken en dublet i indekset eller en
 * dynamisk render.
 */
export function guideHref(slug: string, fra: GuideKilde): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`guideHref: ugyldigt guide-slug "${slug}"`);
  }
  if (!KILDER.includes(fra)) {
    throw new Error(`guideHref: ukendt kilde "${fra}"`);
  }
  return `/bedste/${slug}?fra=${fra}`;
}

const TTL_MS = 60 * 60 * 1000;
let cache: { guides: Map<string, string>; expires: number } | null = null;
let inflight: Promise<Map<string, string>> | null = null;

/**
 * slug -> titel for publicerede guider. Let query (2 kolonner), proces-cachet
 * en time, saa blokkene kan ligge paa sidetyper med tusindvis af sider uden
 * at koste egress pr. render.
 */
export async function getPublishedGuideTitles(): Promise<Map<string, string>> {
  if (cache && cache.expires > Date.now()) return cache.guides;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await createPublicClient()
        .from("buying_guides")
        .select("slug, title")
        .eq("status", "published");
      const map = new Map<string, string>(
        ((data as { slug: string; title: string }[]) ?? []).map((g) => [g.slug, g.title])
      );
      if (map.size > 0) cache = { guides: map, expires: Date.now() + TTL_MS };
      return map;
    } catch (error) {
      console.error("Supabase error (guide titles):", error);
      return new Map<string, string>();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Kun til tests: tvinger naeste kald til at hente titlerne igen. */
export function _nulstilGuideTitelCache(): void {
  cache = null;
  inflight = null;
}

export interface GuideKandidat {
  slug: string;
  reason: string;
  /** null = altid relevant. */
  when?: boolean;
}

/**
 * Foerste `limit` kandidater der baade er relevante og faktisk publicerede.
 * Guider der ikke findes springes over, saa vi aldrig linker til en doed side,
 * og en guide der senere publiceres dukker op af sig selv.
 */
export async function resolveGuideLinks(
  kandidater: GuideKandidat[],
  limit = 3
): Promise<GuideLink[]> {
  const titles = await getPublishedGuideTitles();
  if (titles.size === 0) return [];

  const out: GuideLink[] = [];
  const seen = new Set<string>();
  for (const k of kandidater) {
    if (out.length >= limit) break;
    if (k.when === false) continue;
    if (seen.has(k.slug)) continue;
    const title = titles.get(k.slug);
    if (!title) continue;
    seen.add(k.slug);
    out.push({ slug: k.slug, title, reason: k.reason });
  }
  return out;
}

/**
 * Er maaneden i den kolde halvdel af aaret? Styrer hvilken sesongguide der
 * foreslaas. `maaned` er 1-12 og injiceres, saa tests ikke afhaenger af
 * kalenderen.
 */
export function erKoldSaeson(maaned: number): boolean {
  return maaned >= 10 || maaned <= 3;
}

/**
 * Forsidens fire fremhaevede guider.
 *
 * Valgt paa affiliate_clicks, ikke paa fornemmelse. Klik pr. guide maalt
 * 8. november 2026 over de seks maaneder med data (jun-nov):
 *
 *   sovepose             213   (jun 22, jul 52, aug 71, sep 34, okt 28, nov 6)
 *   campingstol          133   (jun 31, jul 62, aug 22, sep 9, okt 9, nov 0)
 *   sovepose-til-vinter  116   (jun 3, jul 12, aug 35, sep 31, okt 19, nov 16)
 *   vandfilter           110   (jun 9, jul 7, aug 7, sep 12, okt 43, nov 32)
 *   liggeunderlag        102   (jun 1, jul 25, aug 44, sep 17, okt 10, nov 5)
 *
 * Summen alene vaelger forkert. November taeller kun 8 dage, saa i tempo pr.
 * maaned ligger vandfilter nu paa ~120 og sovepose paa ~22: vandfilter er
 * sitets stoerste indtjener lige nu, og det er to maaneders trend (okt 43),
 * ikke et udsving. Campingstol er omvendt ren sommer og ville vaere et spildt
 * forsideslot i november.
 *
 * Derfor: de tre der baerer efteraaret, plus sovepose som den guide der
 * konverterer paa intention frem for saeson. Listen skal efterses naar
 * saesonen skifter — det er et redaktionelt valg, ikke en beregning.
 */
export const FORSIDE_GUIDER: GuideKandidat[] = [
  { slug: "sovepose", reason: "Det valg der betyder mest for nattesøvnen" },
  { slug: "sovepose-til-vinter", reason: "Til nætter under frysepunktet" },
  { slug: "vandfilter", reason: "Når der ikke er vand på pladsen" },
  { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
];

export interface StedFakta {
  /** Antal shelters paa siden. */
  antal: number;
  /** Hvor mange af dem der har adgang til vand. */
  medVand: number;
  /** Maaned 1-12. Injiceres, saa render og test er forudsigelige. */
  maaned: number;
}

/**
 * Guider til en stedsside (by, omraade, region).
 *
 * Sitet har 955 by-sider. En identisk blok paa dem alle er praecis den slags
 * boilerplate Google rabatterer, saa begrundelsen skal komme fra stedets egne
 * tal: hvor mange af netop disse pladser der mangler vand, og hvilken saeson
 * det er. Det er den samme mekanik som grej-blokken paa shelter-siderne, bare
 * aggregeret, og det koster ingen ekstra query — by-siden har allerede
 * `shelters` og `withWater` i haanden.
 */
export function stedKandidater(f: StedFakta): GuideKandidat[] {
  const udenVand = Math.max(0, f.antal - f.medVand);
  const kold = erKoldSaeson(f.maaned);

  return [
    {
      slug: "sovepose",
      reason: "Til overnatning i shelter",
    },
    {
      slug: "vandfilter",
      reason:
        udenVand === 1
          ? "1 af pladserne har ikke vand"
          : `${udenVand} af pladserne har ikke vand`,
      when: udenVand > 0,
    },
    {
      slug: "sovepose-til-vinter",
      reason: "Til vinterhalvårets nætter",
      when: kold,
    },
    {
      slug: "liggeunderlag",
      reason: "Isolering mod den kolde bund",
      when: !kold,
    },
  ];
}

/**
 * Temasiderne (/shelter-med-*, /fri-teltning, ...). Hver side har ét konkret
 * emne, saa koblingen til en guide er aegte redaktionel og ikke en
 * udfyldningsblok. Sider der ikke staar her faar ingen blok.
 */
export const TEMA_KANDIDATER: Record<string, GuideKandidat[]> = {
  "shelter-med-baalplads": [
    { slug: "taendstaal", reason: "Til at få ild i bålet" },
    { slug: "oekse", reason: "Brændet skal skæres" },
    { slug: "baalpande", reason: "Hvor bålet skal hæves fra jorden" },
  ],
  "shelter-med-vand": [
    { slug: "drikkedunk", reason: "Til at fylde op på pladsen" },
    { slug: "sovepose", reason: "Til overnatning i shelter" },
  ],
  "shelter-naer-vand": [
    { slug: "vandfilter", reason: "Overfladevand skal renses før det drikkes" },
    { slug: "drikkedunk", reason: "Til at bære vandet med" },
  ],
  "shelter-med-hund": [
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
    { slug: "sovepose", reason: "Til overnatning i shelter" },
  ],
  "shelter-til-familier": [
    { slug: "sovepose-til-boern", reason: "Soveposer i børnestørrelser" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  "shelter-til-cykeltur": [
    { slug: "sovepose", reason: "Pakkemålet betyder mest på cyklen" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  "fri-teltning": [
    { slug: "telt", reason: "Til de pladser hvor du selv rejser lejr" },
    { slug: "sovepose", reason: "Til overnatning i naturen" },
  ],
  teltplads: [
    { slug: "telt", reason: "Til overnatning på teltpladsen" },
    { slug: "sovepose", reason: "Til overnatning i naturen" },
  ],
};
