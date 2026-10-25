import { createPublicClient } from "@/utils/supabase/server-public";
import { getWater, getSeason, getFirewood } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";

export interface GuideLink {
  slug: string;
  title: string;
  /** Hvorfor netop denne guide er relevant for netop dette shelter. */
  reason: string;
}

type GuideRow = { slug: string; title: string };

/**
 * Købsguider (/bedste) er den kanal der beviseligt tjener. Shelter-siderne har
 * volumen (1.830 sider) men linkede ikke derind, så blokken blev bygget til at
 * matche guiderne mod shelterets FAKTISKE faciliteter — ingen vand på pladsen
 * er et konkret problem, som et vandfilter løser.
 *
 * Blokken virker, men ikke som antaget. Målt over 30 dage: 3.771 visninger,
 * 98 klik videre til en guide (2,6 %) og 9 affiliate-klik. Fordelingen er det
 * interessante:
 *
 *   sovepose             23 klik ->  9 affiliate  (39 %)
 *   taendstaal           36 klik ->  0 affiliate
 *   sovepose-til-vinter  16 klik ->  0 affiliate
 *   vandfilter           11 klik ->  0 affiliate
 *   de oevrige fire      12 klik ->  0 affiliate
 *
 * Ét af otte forslag baerer hele omsaetningen, og det er det generiske. Og det
 * er ikke guidesiderne der fejler: /bedste/taendstaal konverterede syv
 * affiliate-klik paa 42 dage fra ANDEN trafik. Nogen der laeser om et bestemt
 * shelter og klikker "taendstaal fordi der er baalplads" er nysgerrig, ikke
 * indkoebende. "Jeg skal sove i shelter" er derimod en koebsintention.
 *
 * Derfor staar sovepose nu foerst uanset pladsens faciliteter. De specifikke
 * forslag beholder plads to og tre, hvor de stadig giver relevans og interne
 * links til de guider, der ellers ingen har.
 */

/** Kandidater i prioriteret rækkefølge. `when` = null betyder altid relevant. */
const RULES: Array<{
  slug: string;
  reason: string;
  when: ((s: Shelter) => boolean) | null;
}> = [
  // Plads 1, uanset pladsen. Den eneste af blokkens forslag der konverterer,
  // og grunden er intentionen frem for relevansen: man skal sove i shelteret.
  { slug: "sovepose", reason: "til overnatning i shelter", when: null },

  // Plads 2 og 3: de specifikke, der matcher pladsens faciliteter. De
  // konverterer ikke maalbart, men de klikkes (62 af 98 klik), og de er de
  // eneste interne links de guider faar fra shelter-siderne.
  {
    slug: "vandfilter",
    reason: "der er ikke vand på pladsen",
    when: (s) => getWater(s) !== true,
  },
  {
    slug: "taendstaal",
    reason: "der er bålplads",
    when: (s) => getFirewood(s) === true,
  },
  {
    // Ny kategori fra oktober 2026. Samme betingelse som taendstaal: har
    // pladsen en baalplads, skal braendet skaeres. Guiden havde ingen
    // indgaaende links ud over /bedste.
    slug: "oekse",
    reason: "der er bålplads",
    when: (s) => getFirewood(s) === true,
  },
  {
    slug: "sovepose-til-vinter",
    reason: "pladsen er åben hele året",
    when: (s) => /hele året|helårs/i.test(getSeason(s)?.label ?? ""),
  },
  {
    // Ny kategori fra oktober 2026. Et lunt lag er det man mangler, naar man
    // sidder stille paa en aaben plads i november.
    slug: "dunjakke",
    reason: "pladsen er åben hele året",
    when: (s) => /hele året|helårs/i.test(getSeason(s)?.label ?? ""),
  },
  {
    slug: "drikkedunk",
    reason: "du skal selv medbringe vand",
    when: (s) => getWater(s) !== true,
  },
  // Baseline-udfyldning, hvis pladsen ikke udloeser noget specifikt.
  { slug: "liggeunderlag", reason: "isolering mod kold bund", when: null },
  { slug: "pandelampe", reason: "til de mørke timer", when: null },
];

const TTL_MS = 60 * 60 * 1000;
let cache: { guides: Map<string, string>; expires: number } | null = null;
let inflight: Promise<Map<string, string>> | null = null;

/** slug → titel for publicerede guider. Let query (2 kolonner), proces-cachet. */
async function getPublishedGuideTitles(): Promise<Map<string, string>> {
  if (cache && cache.expires > Date.now()) return cache.guides;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await createPublicClient()
        .from("buying_guides")
        .select("slug, title")
        .eq("status", "published");
      const map = new Map<string, string>(
        ((data as GuideRow[]) ?? []).map((g) => [g.slug, g.title])
      );
      if (map.size > 0) cache = { guides: map, expires: Date.now() + TTL_MS };
      return map;
    } catch (error) {
      console.error("Supabase error (guide titles for gear suggestions):", error);
      return new Map<string, string>();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Op til `limit` købsguider der passer til dette shelter. Kun guider der
 * faktisk er publicerede returneres, så vi aldrig linker til en død side.
 */
export async function getGearSuggestions(
  shelter: Shelter,
  limit = 3
): Promise<GuideLink[]> {
  const titles = await getPublishedGuideTitles();
  if (titles.size === 0) return [];

  const out: GuideLink[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (out.length >= limit) break;
    if (seen.has(rule.slug)) continue;
    if (rule.when && !rule.when(shelter)) continue;
    const title = titles.get(rule.slug);
    if (!title) continue;
    seen.add(rule.slug);
    out.push({ slug: rule.slug, title, reason: rule.reason });
  }

  return out;
}

/**
 * Link fra grej-blokken til en købsguide, mærket med hvor klikket kom fra.
 *
 * Blokken ligger på 1.609 shelter-sider, som tilsammen står for omkring en
 * tredjedel af sitets Google-klik, men den havde ingen måling overhovedet —
 * hverken på klikket eller på hvad det førte til. `?fra=shelter` følger med
 * ind i `affiliate_clicks.path`, så et køb kan henføres til tragten uden ny
 * infrastruktur. Guidens canonical peger på den rene URL, så parameteren
 * skaber ikke en dublet i indekset.
 */
export function gearSuggestionHref(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`gearSuggestionHref: ugyldigt guide-slug "${slug}"`);
  }
  return `/bedste/${slug}?fra=shelter`;
}
