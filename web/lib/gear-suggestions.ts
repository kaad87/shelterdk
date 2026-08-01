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
 * Købsguider (/bedste) er den kanal der beviseligt tjener: 232 af 242
 * affiliate-klik på 30 dage kom derfra. Shelter-siderne har til gengæld
 * volumen (1683 sider) men linkede ikke derind. Her matcher vi guiderne mod
 * shelterets FAKTISKE faciliteter, så forslaget er reelt nyttigt frem for et
 * generisk "se vores guider" — ingen vand på pladsen er et konkret problem,
 * som et vandfilter løser.
 */

/** Kandidater i prioriteret rækkefølge. `when` = null betyder altid relevant. */
const RULES: Array<{
  slug: string;
  reason: string;
  when: ((s: Shelter) => boolean) | null;
}> = [
  {
    slug: "vandfilter",
    reason: "der er ikke vand på pladsen",
    when: (s) => getWater(s) !== true,
  },
  {
    slug: "drikkedunk",
    reason: "du skal selv medbringe vand",
    when: (s) => getWater(s) !== true,
  },
  {
    slug: "taendstaal",
    reason: "der er bålplads",
    when: (s) => getFirewood(s) === true,
  },
  {
    slug: "sovepose-til-vinter",
    reason: "pladsen er åben hele året",
    when: (s) => /hele året|helårs/i.test(getSeason(s)?.label ?? ""),
  },
  {
    slug: "liggeunderlag-til-vinter",
    reason: "pladsen er åben hele året",
    when: (s) => /hele året|helårs/i.test(getSeason(s)?.label ?? ""),
  },
  // Baseline — relevant for enhver overnatning i shelter.
  { slug: "sovepose", reason: "til overnatning i shelter", when: null },
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
