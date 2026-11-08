import { createPublicClient } from "@/utils/supabase/server-public";

export interface GuideLink {
  slug: string;
  title: string;
  /** Hvorfor netop denne guide er relevant netop her. */
  reason: string;
}

/** Hvor i sitet linket staar. Foelger med ind i affiliate_clicks.path. */
export type GuideKilde =
  | "shelter"
  | "forside"
  | "by"
  | "kommune"
  | "region"
  | "omraade"
  | "rute"
  | "tema"
  | "hub";

const KILDER: readonly GuideKilde[] = [
  "shelter",
  "forside",
  "by",
  "kommune",
  "region",
  "omraade",
  "rute",
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
  /**
   * Kun med i den halvdel af aaret. Udeladt = hele aaret.
   *
   * Findes fordi TEMA_KANDIDATER er en statisk tabel og derfor ikke kan kalde
   * erKoldSaeson() selv, sådan som stedKandidater og ruteKandidater goer.
   * `temaKandidater()` oversaetter feltet til et `when` ved opslaget.
   */
  saeson?: "kold" | "varm";
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
  /**
   * Hvor mange af dem der har adgang til vand, eller null naar siden ikke
   * henter vand-kolonnen.
   *
   * null er ikke det samme som 0. /shelter-med-toilet henter sine 50 pladser
   * med et select uden `water`, saa getWater gav false for dem alle, og
   * blokken skrev "50 af pladserne har ikke vand" paa siden. Det er en
   * paastand om virkeligheden, ikke en tom tilstand, saa typen skal kunne
   * sige "ved ikke" og kalderen skal tage stilling.
   */
  medVand: number | null;
  /** Maaned 1-12. Injiceres, saa render og test er forudsigelige. */
  maaned: number;
}

/**
 * Under dette antal pladser faar en stedsside ingen guide-blok.
 *
 * Variationen er hele begrundelsen for at laegge blokken paa stedssiderne, og
 * paa de smaa sider findes den ikke. Stikproeve paa 60 af de 955 by-sider
 * 8. november 2026: median 1 shelter, gennemsnit 3,1. Paa en side med én
 * plads bliver blokken "Til overnatning i shelter" + "1 af pladserne har ikke
 * vand" + saesonguiden, altsaa stort set ordret den samme tekst paa flere
 * hundrede sider — praecis den boilerplate blokken skulle undgaa.
 *
 * Fem pladser rammer ~64 af de 955 sider. Det er dem der har trafik
 * (/by/koebenhavn 413 Google-klik paa 90 dage) og dem hvor tallet faktisk
 * varierer: Koebenhavn 5 uden vand, Bornholm 16.
 */
export const MIN_STEDSTOERRELSE = 5;

/**
 * Guider til en stedsside (by, omraade, region).
 *
 * Begrundelsen kommer fra stedets egne tal: hvor mange af netop disse pladser
 * der mangler vand, og hvilken saeson det er. Det er den samme mekanik som
 * grej-blokken paa shelter-siderne, bare aggregeret, og det koster ingen
 * ekstra query — by-siden har allerede `shelters` og `withWater` i haanden.
 *
 * Tom liste under MIN_STEDSTOERRELSE: GuideTeaser rendrer ikke uden links, saa
 * blokken forsvinder af sig selv paa de tynde sider.
 */
export function stedKandidater(f: StedFakta): GuideKandidat[] {
  if (f.antal < MIN_STEDSTOERRELSE) return [];
  const udenVand = f.medVand === null ? 0 : Math.max(0, f.antal - f.medVand);
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
 *
 * Slaa altid op med `temaKandidater()`, ikke direkte i tabellen: den
 * oversaetter `saeson` til et `when`, og et direkte opslag ville vise begge
 * saesonvarianter paa én gang.
 */
export const TEMA_KANDIDATER: Record<string, GuideKandidat[]> = {
  // Baalplads og baalhytte havde tre ildpladser hver. Maalt 8. november 2026
  // over 150 dage gav oekse og baalpande NUL affiliate-klik fra seks primaere
  // slots, mens taendstaal gav 31 klik til 78 kr. stykket. De to doede
  // pladser er erstattet af sovegrej, som er det der faktisk koebes af folk
  // der planlaegger en overnatning: sovepose 719 kr./klik, vintersovepose
  // 979 kr., liggeunderlag 912 kr. Taendstaal bliver, fordi relevansen er
  // aegte og klikkene er der.
  "shelter-med-baalplads": [
    { slug: "taendstaal", reason: "Til at få ild i bålet" },
    { slug: "sovepose-til-vinter", reason: "Til nætter under frysepunktet", saeson: "kold" },
    { slug: "sovepose", reason: "Til overnatning i shelter", saeson: "varm" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
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
    { slug: "familietelt", reason: "Plads til hele familien" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  "shelter-til-cykeltur": [
    { slug: "sovepose", reason: "Pakkemålet betyder mest på cyklen" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  "fri-teltning": [
    { slug: "letvaegtstelt", reason: "Du bærer alt selv" },
    { slug: "sovepose", reason: "Til overnatning i naturen" },
    { slug: "haengekoje", reason: "Et alternativ hvor der er træer" },
  ],
  teltplads: [
    { slug: "telt", reason: "Til overnatning på teltpladsen" },
    { slug: "familietelt", reason: "Plads til hele familien" },
    { slug: "sovepose", reason: "Til overnatning i naturen" },
  ],
  baalhytte: [
    { slug: "taendstaal", reason: "Til at få ild i bålet" },
    { slug: "sovepose-til-vinter", reason: "Til nætter under frysepunktet", saeson: "kold" },
    { slug: "sovepose", reason: "Til overnatning i bålhytten", saeson: "varm" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  haervejen: [
    { slug: "vandrestovler", reason: "Du går langt på ruten" },
    { slug: "sovepose", reason: "Til overnatning undervejs" },
    { slug: "liggeunderlag", reason: "Isolering mod den kolde bund" },
  ],
  gudenaaen: [
    { slug: "dry-bag", reason: "Grejet skal holdes tørt i kanoen" },
    { slug: "sovepose", reason: "Til overnatning undervejs" },
  ],
};

/**
 * Temaets kandidater for den aktuelle maaned.
 *
 * `saeson` oversaettes til `when`, saa resolveGuideLinks kan behandle
 * saesonvarianter som alle andre betingede kandidater. Ukendt tema giver en
 * tom liste, og GuideTeaser rendrer ikke uden links.
 */
export function temaKandidater(tema: string, maaned: number): GuideKandidat[] {
  const kold = erKoldSaeson(maaned);
  return (TEMA_KANDIDATER[tema] ?? []).map((k) =>
    k.saeson === undefined
      ? k
      : { ...k, when: k.when !== false && (k.saeson === "kold") === kold }
  );
}

/**
 * Under denne laengde faar en rute ingen grej-blok.
 *
 * De 224 ruter spaender fra 0,3 til 646 km med median 9,75. En tur paa tre
 * kilometer kraever ingen vandrestoevler, og et raad om fodtoej dér er
 * udfyldning, ikke hjaelp. Graensen holder blokken vaek fra 69 af de 224.
 */
export const MIN_RUTE_KM = 5;

export interface RuteFakta {
  /** Rutens laengde i km. */
  km: number;
  /** Antal shelters langs ruten. */
  shelterAntal: number;
  /** Maaned 1-12. Injiceres, saa render og test er forudsigelige. */
  maaned: number;
}

/**
 * Guider til en vandrerute.
 *
 * Vandrebeklaedning er den eneste gruppe koebsguider uden en aegte vaert
 * blandt shelter-siderne — en pakkeliste til shelter handler om at sove ude,
 * ikke om at gaa langt. Rutesiderne er det modsatte, og de har `length_km`,
 * saa forslaget kan foelge turens faktiske karakter i stedet for at vaere ens
 * paa 224 sider: en dagstur paa 8 km og Haervejens 646 km faar ikke det samme.
 *
 * Graenserne: under 15 km er det en dagstur, fra 40 km er det flere dage.
 */
export function ruteKandidater(f: RuteFakta): GuideKandidat[] {
  if (f.km < MIN_RUTE_KM) return [];
  const dagstur = f.km < 15;
  const flerdags = f.km >= 40;
  const kold = erKoldSaeson(f.maaned);
  const km = Math.round(f.km);

  return [
    { slug: "vandresko", reason: "Ruten kan gås på en dag", when: dagstur },
    { slug: "vandrestovler", reason: `${km} km slider på fødderne`, when: !dagstur },
    {
      slug: "sovepose",
      reason:
        f.shelterAntal === 1
          ? "Der ligger 1 shelter langs ruten"
          : `Der ligger ${f.shelterAntal} shelters langs ruten`,
      when: !dagstur && f.shelterAntal > 0,
    },
    { slug: "drikkedunk", reason: "Vand nok mellem pladserne", when: dagstur },
    { slug: "vandrestav", reason: "Lange etaper slider på knæene", when: flerdags },
    { slug: "vandrebukser", reason: "Du går i det samme i flere dage", when: flerdags },
    {
      slug: "vandrerygsaek",
      reason: "Du bærer det hele selv",
      when: !dagstur && !flerdags,
    },
    { slug: "gamacher", reason: "Vådt og mudret underlag", when: !dagstur && kold },
    { slug: "solhat", reason: "Der er ingen skygge på åben hede", when: !dagstur && !kold },
  ];
}
