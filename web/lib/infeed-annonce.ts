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
import { hentPrisfald } from "@/lib/prisfald-opslag";
import type { Prisfald } from "@/lib/prisfald";
import { rentMaerke, rentNavn } from "@/lib/produktnavn";
import { standardKandidater, type GuideKandidat } from "@/lib/guide-links";

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
/** Naar prisfaldene ikke kunne slaas op. Se hentGuideVarer. */
const FEJL_TTL_MS = 5 * 60 * 1000;
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

      // Feedets foer-pris byttes ud med vores egen (lib/prisfald.ts), saa
      // tilbudsarmen kun kalder en vare nedsat, naar vi selv har set den
      // falde. Kan faldene ikke slaas op, vises ingen rabat, og varerne
      // gemmes kun fem minutter, saa naeste forsoeg kommer hurtigt.
      let fald: Map<string, Prisfald> | null = null;
      try {
        const alle = [...guider.values()].flat().map((v) => ({ id: v.produktId, price: v.pris }));
        fald = await hentPrisfald(alle);
      } catch (err) {
        console.error(`[in-feed] prisfald kunne ikke slaas op: ${err instanceof Error ? err.message : String(err)}`);
      }
      for (const varer of guider.values()) {
        for (const v of varer) {
          const f = fald?.get(v.produktId) ?? null;
          v.foerPris = f ? f.foer : null;
          v.rabatPct = f ? f.pct : null;
        }
      }

      cache = { guider, expires: Date.now() + (fald ? TTL_MS : FEJL_TTL_MS) };
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
 * Vaelger op til `antal` forskellige varer for en arm blandt kandidaternes guider.
 *
 * Kandidaterne kommer fra temaKandidater/stedKandidater og er allerede
 * filtreret paa aarstid og sidens tal. Raekkefoelgen i kandidatlisten er
 * prioriteringen.
 *
 * VARERNE FORDELES PAA GUIDERNE, én runde ad gangen: foerst hver guides bedste
 * vare, saa hver guides naestbedste, og saa videre. Med kun én plads i
 * forsoegets foerste version viste 146 af 172 visninger en sovepose, fordi
 * sovepose stod foerst paa naesten alle sider. Tre pladser med varer fra tre
 * forskellige guider giver baade mere at vaelge imellem og et ærligere maal
 * for, hvad der faktisk bliver klikket paa.
 *
 * `tilbud` tager kun varer med reel foerpris og den stoerste rabat foerst
 * inden for hver guide. Den kan derfor give faerre varer end der er pladser.
 * Det er med vilje: et tilbudskort der falder tilbage til fuld pris ville
 * maale noget andet end det, armen handler om. Pladsen viser da AdSense.
 */
export function vaelgVarer(
  kandidater: GuideKandidat[],
  guider: Map<string, GuideVare[]>,
  arm: InFeedArm,
  antal: number
): InFeedVare[] {
  if (arm === "adsense" || antal <= 0) return [];

  const koeer: { k: GuideKandidat; varer: GuideVare[] }[] = [];
  const setGuider = new Set<string>();
  for (const k of kandidater) {
    if (k.when === false || setGuider.has(k.slug)) continue;
    const alle = guider.get(k.slug);
    if (!alle?.length) continue;
    const varer =
      arm === "tilbud"
        ? [...alle].filter(harRabat).sort((a, b) => (b.rabatPct ?? 0) - (a.rabatPct ?? 0))
        : alle;
    if (!varer.length) continue;
    setGuider.add(k.slug);
    koeer.push({ k, varer });
  }

  const ud: InFeedVare[] = [];
  const setVarer = new Set<string>();
  for (let runde = 0; ud.length < antal; runde++) {
    let fandt = false;
    for (const { k, varer } of koeer) {
      if (ud.length >= antal) break;
      const v = varer[runde];
      if (!v) continue;
      fandt = true;
      // Samme vare kan staa i to guider (fx en sovepose i baade sovepose og
      // dunsovepose). To ens kort paa én side ligner en fejl.
      if (setVarer.has(v.produktId)) continue;
      setVarer.add(v.produktId);
      ud.push({
        produktId: v.produktId,
        navn: v.navn,
        maerke: v.maerke,
        pris: v.pris,
        foerPris: v.foerPris,
        rabatPct: v.rabatPct,
        billede: v.billede,
        url: v.url,
        retailer: v.retailer,
        kategori: v.kategori,
        begrundelse: k.reason,
        guideSlug: k.slug,
      });
    }
    if (!fandt) break;
  }
  return ud;
}

/** Den foerste vare armen ville vise. Se vaelgVarer. */
export function vaelgVare(
  kandidater: GuideKandidat[],
  guider: Map<string, GuideVare[]>,
  arm: InFeedArm
): InFeedVare | null {
  return vaelgVarer(kandidater, guider, arm, 1)[0] ?? null;
}

/** Pladser pr. liste. Samme loft som IN_FEED_MAX_PER_PAGE i lib/adsense.ts. */
export const IN_FEED_PLADSER = 3;

/**
 * Alt kaldestedet behoever: armen og en vare pr. plads. En plads uden vare
 * viser AdSense, uanset om det er fordi armen er `adsense`, eller fordi
 * guiderne ikke kunne levere nok varer armen kan bruge.
 */
export interface InFeedAnnonce {
  arm: InFeedArm;
  /** Varerne til plads 0, 1 og 2, i den raekkefoelge. */
  varer: InFeedVare[];
}

/**
 * Armen for en side uden en stabil sti at hashe paa, i praksis /soeg.
 *
 * /soeg er én sti, saa vaelgArm ville laase hele sitets mest besoegte
 * listeside fast i én arm. Her skifter armen hver hele time i stedet. Det er
 * stadig stabilt inden for en render og en ISR-periode (siden revaliderer hver
 * time), og maalingen klarer sig uden stien: infeed_seen baerer armen i
 * params, og klikkets placement hedder infeed_<arm>.
 */
export function armForTime(nu: Date = new Date()): InFeedArm {
  return IN_FEED_ARME[Math.floor(nu.getTime() / 3_600_000) % IN_FEED_ARME.length];
}

export async function hentInFeedAnnonce(
  sti: string,
  kandidater: GuideKandidat[],
  opts: { arm?: InFeedArm; nu?: Date } = {}
): Promise<InFeedAnnonce> {
  const arm = opts.arm ?? vaelgArm(sti);
  if (arm === "adsense") return { arm, varer: [] };
  // En side uden egne emne-guider (smaa stedssider, /soeg) fik foer AdSense.
  // Nu faar den saesonens overnatningsgrej, som er relevant paa enhver liste
  // over shelters.
  // Sidens egne kandidater staar foerst, saa de vinder pladserne; saesonens
  // fylder op, naar siden har faerre guider end der er pladser.
  const brugte = [...kandidater, ...standardKandidater((opts.nu ?? new Date()).getMonth() + 1)];
  const guider = await hentGuideVarer();
  return { arm, varer: vaelgVarer(brugte, guider, arm, IN_FEED_PLADSER) };
}
