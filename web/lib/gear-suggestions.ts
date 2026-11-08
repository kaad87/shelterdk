import { getWater, getSeason, getFirewood } from "@/lib/shelter-detail";
import { guideHref, resolveGuideLinks } from "@/lib/guide-links";
import type { GuideKandidat, GuideLink } from "@/lib/guide-links";
import type { Shelter } from "@/types/shelter";

export type { GuideLink };

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
 *
 * Titelopslaget og slug-valideringen ligger i lib/guide-links.ts, som ogsaa
 * driver blokkene paa forsiden, stedssiderne og temasiderne. De skal dele
 * proces-cachen: ellers henter hver sidetype titlerne for sig.
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

/**
 * Op til `limit` købsguider der passer til dette shelter. Kun guider der
 * faktisk er publicerede returneres, så vi aldrig linker til en død side.
 */
export async function getGearSuggestions(
  shelter: Shelter,
  limit = 3
): Promise<GuideLink[]> {
  const kandidater: GuideKandidat[] = RULES.map((r) => ({
    slug: r.slug,
    reason: r.reason,
    when: r.when ? r.when(shelter) : true,
  }));
  return resolveGuideLinks(kandidater, limit);
}

/**
 * Link fra grej-blokken til en købsguide, mærket med hvor klikket kom fra.
 *
 * Blokken ligger på 1.609 shelter-sider, som tilsammen står for omkring en
 * tredjedel af sitets Google-klik, men den havde ingen måling overhovedet —
 * hverken på klikket eller på hvad det førte til. `?fra=shelter` følger med
 * ind i `affiliate_clicks.path`, så et køb kan henføres til tragten uden ny
 * infrastruktur.
 *
 * Kilden holdes adskilt fra de andre blokkes (`forside`, `by`, `tema`, ...),
 * fordi de 30-dages-tal der er dokumenteret ovenfor kun kan sammenlignes over
 * tid hvis `fra=shelter` bliver ved med kun at betyde shelter-siderne.
 */
export function gearSuggestionHref(slug: string): string {
  return guideHref(slug, "shelter");
}
