/**
 * Affiliate-produktkort i den in-feed-plads der i dag holder en AdSense-blok.
 *
 * BAGGRUNDEN. AdSense giver naesten ingenting, og pladsen findes allerede:
 * `AdInFeed` optager én kortplads i shelter-grid'et paa 15 flader. Spoergsmaalet
 * er derfor ikke om vi skal bygge en ny annonceflade, men hvad der skal fylde
 * den vi har. Findshelter.dk viser et affiliate-produktkort samme sted.
 *
 * HVORFOR DIREKTE TIL FORHANDLEREN og ikke ind i en guide: grej-blokken paa
 * shelter-siderne blev maalt til 98 guideklik ud af 3.771 visninger, hvoraf kun
 * 9 blev til affiliate-klik. Det andet hop er laekken. Kortet her springer det
 * over.
 *
 * HVORFOR VAREN KOMMER FRA EN GUIDE. Kortet viser ikke en tilfaeldig vare fra
 * feedet paa 18.209. Det viser vinderen fra den /bedste-guide der i forvejen
 * matcher siden, fundet med samme `temaKandidater`/`stedKandidater`-logik som
 * guide-blokkene. Saa arver kortet den redaktionelle udvaelgelse, praedikatet og
 * lagertjekket i stedet for at vi bygger en ny og daarligere udvaelgelse ved
 * siden af.
 *
 * FORSOEGET. Fire arme fordelt paa sidens sti, saa valget er stabilt og kan
 * caches (siderne er ISR). AdSense faar ogsaa plads 1 paa en fjerdedel af
 * siderne, saa sammenligningen sker i SAMME position og ikke mellem plads 1 og
 * plads 2. Plads 2 og 3 er uaendret AdSense, saa annoncetaetheden er den samme
 * som i dag og indtjeningsgulvet bevares.
 *
 * MAALINGEN er varepris gange klik, ikke provision, indtil Awin-noeglen er
 * fornyet. To varer med samme pris kan give vidt forskellig indtjening, saa
 * tallene her rangerer arme indbyrdes og er ikke en omsaetning.
 */
import { createPublicClient } from "@/utils/supabase/server-public";
import { rentMaerke, rentNavn } from "@/lib/produktnavn";
import type { GuideKandidat } from "@/lib/guide-links";

/**
 * De fire arme i forsoeget.
 *
 * `ren` er findshelters model ét til ét. `tilbud` viser kun varer med reel
 * foerpris. `kontekst` er `ren` plus kandidatens begrundelse, altsaa den linje
 * der knytter varen til sidens emne og aarstid.
 */
export type InFeedArm = "adsense" | "ren" | "tilbud" | "kontekst";

export const IN_FEED_ARME: readonly InFeedArm[] = ["adsense", "ren", "tilbud", "kontekst"];

/**
 * FNV-1a over stien. Vi skal bruge en fordeling der er ens ved hver render af
 * samme side (ellers ville ISR-cachen alligevel fryse ét tilfaeldigt valg fast)
 * og som ikke kraever en roundtrip. Math.random ville give layout-hop og
 * ubrugelige tal; et hash af stien giver begge dele gratis.
 */
export function stiHash(sti: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < sti.length; i++) {
    h ^= sti.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Armen for en given side. Samme sti giver altid samme arm. */
export function vaelgArm(sti: string): InFeedArm {
  const rent = sti.split("?")[0].replace(/\/+$/, "") || "/";
  return IN_FEED_ARME[stiHash(rent) % IN_FEED_ARME.length];
}

export interface InFeedVare {
  produktId: string;
  navn: string;
  maerke: string | null;
  pris: number;
  foerPris: number | null;
  rabatPct: number | null;
  billede: string;
  url: string;
  retailer: string;
  kategori: string | null;
  /** Kandidatens begrundelse. Vises kun i armen `kontekst`. */
  begrundelse: string;
  guideSlug: string;
}

/** Én vare som den ligger i cachen, foer en arm har valgt mellem dem. */
interface GuideVare {
  produktId: string;
  rank: number;
  navn: string;
  maerke: string | null;
  pris: number;
  foerPris: number | null;
  rabatPct: number | null;
  billede: string;
  url: string;
  retailer: string;
  kategori: string | null;
}

type RaaProdukt = {
  id: string;
  product_name: string | null;
  brand: string | null;
  display_name: string | null;
  display_brand: string | null;
  price: number | null;
  price_original: number | null;
  discount_pct: number | null;
  image_url: string | null;
  affiliate_url: string | null;
  in_stock: boolean | null;
  is_blocked: boolean | null;
  retailer: string | null;
  category_mapped: string | null;
};

type RaaRaekke = {
  slug: string;
  buying_guide_entries: {
    rank: number | null;
    affiliate_products: RaaProdukt | null;
  }[] | null;
};

/**
 * Er varen reelt nedsat? Samme betingelse som kortene bruger i forvejen
 * (GearCardClient), saa et "SPAR"-maerke her og en overstreget pris der ikke
 * kan komme ud af trit.
 */
export function harRabat(v: Pick<GuideVare, "pris" | "foerPris">): boolean {
  return v.foerPris != null && v.foerPris > v.pris;
}

const TTL_MS = 60 * 60 * 1000;
let cache: { guider: Map<string, GuideVare[]>; expires: number } | null = null;
let inflight: Promise<Map<string, GuideVare[]>> | null = null;

/** Kun til tests: tvinger naeste kald til at hente igen. */
export function _nulstilInFeedCache(): void {
  cache = null;
  inflight = null;
}

/**
 * Koebbare varer pr. publiceret guide, sorteret som guiden selv.
 *
 * Ét opslag for alle guider, ikke ét pr. side. Kortet skal kunne staa paa
 * enhver listeside, og uden proces-cache ville det laegge en query oven i hver
 * eneste render. Samme moenster som getPublishedGuideTitles i guide-links.ts.
 */
export async function hentGuideVarer(): Promise<Map<string, GuideVare[]>> {
  const nu = Date.now();
  if (cache && cache.expires > nu) return cache.guider;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const sb = createPublicClient();
      const { data, error } = await sb
        .from("buying_guides")
        .select(
          "slug, buying_guide_entries(rank, affiliate_products(id, product_name, brand, " +
            "display_name, display_brand, price, price_original, discount_pct, image_url, " +
            "affiliate_url, in_stock, is_blocked, retailer, category_mapped))"
        )
        .eq("status", "published");
      if (error) throw error;

      const guider = new Map<string, GuideVare[]>();
      for (const raekke of (data ?? []) as unknown as RaaRaekke[]) {
        const varer: GuideVare[] = [];
        for (const e of raekke.buying_guide_entries ?? []) {
          const p = e.affiliate_products;
          // Udsolgte og blokerede ryger ud her og ikke i visningen: et kort der
          // sender folk til en vare de ikke kan koebe er vaerre end ingen
          // annonce. Samme grund til at url og billede skal findes.
          if (!p || p.is_blocked || p.in_stock === false) continue;
          if (typeof p.price !== "number" || !p.affiliate_url || !p.image_url) continue;
          const navn = rentNavn(p);
          if (!navn) continue;
          varer.push({
            produktId: p.id,
            rank: e.rank ?? 999,
            navn,
            maerke: rentMaerke(p),
            pris: p.price,
            foerPris: p.price_original,
            rabatPct: p.discount_pct,
            billede: p.image_url,
            url: p.affiliate_url,
            retailer: p.retailer ?? "ukendt",
            kategori: p.category_mapped,
          });
        }
        varer.sort((a, b) => a.rank - b.rank);
        if (varer.length) guider.set(raekke.slug, varer);
      }

      cache = { guider, expires: Date.now() + TTL_MS };
      return guider;
    } catch (error) {
      // Samme valg som resolveGuideLinks: en nede database skal give en side
      // uden annonce, ikke en side der kaster.
      console.error("Supabase error (in-feed varer):", error);
      return new Map<string, GuideVare[]>();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Vaelger varen for en arm blandt kandidaternes guider.
 *
 * Kandidaterne kommer fra temaKandidater/stedKandidater og er allerede
 * filtreret paa aarstid og sidens tal. Vi tager den foerste guide der har en
 * brugbar vare, saa raekkefoelgen i kandidatlisten er prioriteringen.
 *
 * `tilbud` kan returnere null selv om der findes varer. Det er med vilje:
 * maalt 8. november 2026 var der NUL soveposer over 500 kr. med reel foerpris
 * i kataloget og kun to liggeunderlag, saa rabatterne sidder i de billige
 * varer. Et tilbudskort der falder tilbage til fuld pris ville maale noget
 * andet end det, armen handler om. Kaldestedet viser AdSense i stedet.
 */
export function vaelgVare(
  kandidater: GuideKandidat[],
  guider: Map<string, GuideVare[]>,
  arm: InFeedArm
): InFeedVare | null {
  if (arm === "adsense") return null;

  for (const k of kandidater) {
    if (k.when === false) continue;
    const varer = guider.get(k.slug);
    if (!varer?.length) continue;

    const valgt =
      arm === "tilbud"
        ? [...varer].filter(harRabat).sort((a, b) => (b.rabatPct ?? 0) - (a.rabatPct ?? 0))[0]
        : varer[0];
    if (!valgt) continue;

    return {
      produktId: valgt.produktId,
      navn: valgt.navn,
      maerke: valgt.maerke,
      pris: valgt.pris,
      foerPris: valgt.foerPris,
      rabatPct: valgt.rabatPct,
      billede: valgt.billede,
      url: valgt.url,
      retailer: valgt.retailer,
      kategori: valgt.kategori,
      begrundelse: k.reason,
      guideSlug: k.slug,
    };
  }
  return null;
}

/**
 * Alt kaldestedet behoever: armen og varen. Null-vare betyder "vis AdSense",
 * uanset om det er fordi armen er `adsense`, eller fordi ingen guide kunne
 * levere en vare armen kan bruge.
 */
export interface InFeedAnnonce {
  arm: InFeedArm;
  vare: InFeedVare | null;
}

export async function hentInFeedAnnonce(
  sti: string,
  kandidater: GuideKandidat[]
): Promise<InFeedAnnonce> {
  const arm = vaelgArm(sti);
  if (arm === "adsense" || kandidater.length === 0) return { arm, vare: null };
  const guider = await hentGuideVarer();
  return { arm, vare: vaelgVare(kandidater, guider, arm) };
}
