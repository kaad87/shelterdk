import { createClient } from "@supabase/supabase-js";
import { hentPrisfald } from "./prisfald-opslag";
import type { Prisfald } from "./prisfald";

/**
 * Hvor mange af hver guides varer er faldet i pris? Tallet staar som et
 * maerke paa guide-links: "3 varer faldet i pris".
 *
 * Linkene staar paa forsiden, paa by-, region-, kommune- og temasiderne og i
 * grej-blokken paa shelter-siderne. Guiderne giver 92,6 % af grej-klikkene,
 * men kun 3 % af dem der ser grej-blokken klikker videre (maalt 16/11 2026).
 * Maerket skal give en grund til at klikke netop nu.
 *
 * Optaellingen bruger samme regel som guidesiden selv (lib/prisfald.ts), saa
 * tallet paa linket og det linket fører til er det samme. Kun varer der kan
 * koebes taeller: en udsolgt vare med prisfald kan ingen handle paa.
 */

export function taelPrisfald(
  guider: { id: string; slug: string }[],
  entries: { guide_id: string; affiliate_product_id: string }[],
  varer: { id: string; in_stock: boolean; is_blocked: boolean }[],
  fald: Map<string, Prisfald>
): Map<string, number> {
  const koebbar = new Set(varer.filter((v) => v.in_stock && !v.is_blocked).map((v) => v.id));
  const slugEfterId = new Map(guider.map((g) => [g.id, g.slug]));
  const prGuide = new Map<string, Set<string>>();
  for (const e of entries) {
    const slug = slugEfterId.get(e.guide_id);
    if (!slug || !koebbar.has(e.affiliate_product_id) || !fald.has(e.affiliate_product_id)) continue;
    const s = prGuide.get(slug) ?? new Set<string>();
    s.add(e.affiliate_product_id);
    prGuide.set(slug, s);
  }
  return new Map([...prGuide].map(([slug, s]) => [slug, s.size]));
}

/**
 * En time, som guide-titlerne i lib/guide-links.ts. Prisfaldene skifter med
 * den natlige synk, saa et svar der er en time gammelt er stadig rigtigt.
 */
const TTL_MS = 60 * 60 * 1000;
/**
 * Saa laenge venter en side paa et koldt opslag. Bagefter renderes den uden
 * maerker, og opslaget koerer videre og fylder cachen.
 *
 * Laenge, med vilje. Var 1,5 s, ud fra en antagelse om at shelter-siderne
 * var dynamiske. Det er de ikke: ALLE sider med guide-links er ISR med
 * revalidate = 86400. Foerste visning efter deployet 16/11 2026 ramte en kold
 * server, optaellingen naaede ikke at blive faerdig, og forsiden blev gemt
 * uden et eneste maerke i et doegn. En ISR-side genbygges i baggrunden mens
 * den gamle vises, saa ventetiden rammer naesten aldrig en bruger, mens en
 * for kort graense rammer alle i 24 timer.
 */
const VENT_MS = 10_000;

let cache: { antal: Map<string, number>; expires: number } | null = null;
let inflight: Promise<Map<string, number> | null> | null = null;

async function hent(): Promise<Map<string, number> | null> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const g = await sb.from("buying_guides").select("id, slug").eq("status", "published");
    if (g.error) throw new Error(g.error.message);
    const guider = (g.data ?? []) as { id: string; slug: string }[];
    if (guider.length === 0) return new Map();

    const e = await sb
      .from("buying_guide_entries")
      .select("guide_id, affiliate_product_id")
      .in("guide_id", guider.map((x) => x.id));
    if (e.error) throw new Error(e.error.message);
    const entries = (e.data ?? []) as { guide_id: string; affiliate_product_id: string }[];
    const ids = [...new Set(entries.map((x) => x.affiliate_product_id))];
    if (ids.length === 0) return new Map();

    const p = await sb.from("affiliate_products").select("id, price, in_stock, is_blocked").in("id", ids);
    if (p.error) throw new Error(p.error.message);
    const varer = (p.data ?? []) as { id: string; price: number; in_stock: boolean; is_blocked: boolean }[];

    const fald = await hentPrisfald(varer.filter((v) => v.in_stock && !v.is_blocked));
    return taelPrisfald(guider, entries, varer, fald);
  } catch (err) {
    // Aldrig kaste: maerket er en bonus paa et link, der virker uden det.
    console.error(`[guide-prisfald] kunne ikke taelle: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * slug -> antal koebbare varer med aegte prisfald. Guider uden fald mangler.
 *
 * Kaster aldrig og venter hoejst `ventMs`. Et fejlet opslag gemmes ikke, saa
 * naeste kald proever igen; et for langsomt opslag faar lov at blive faerdigt
 * og fylder cachen.
 */
export async function getGuidePrisfaldAntal(opts: { ventMs?: number } = {}): Promise<Map<string, number>> {
  if (cache && cache.expires > Date.now()) return cache.antal;
  if (!inflight) {
    inflight = hent().then((antal) => {
      if (antal) cache = { antal, expires: Date.now() + TTL_MS };
      inflight = null;
      return antal;
    });
  }
  const ventMs = opts.ventMs ?? VENT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const forSent = new Promise<null>((r) => {
    timer = setTimeout(() => r(null), ventMs);
  });
  const svar = await Promise.race([inflight, forSent]);
  clearTimeout(timer);
  return svar ?? new Map();
}

/** Kun til tests. */
export function _nulstilGuidePrisfaldCache(): void {
  cache = null;
  inflight = null;
}
