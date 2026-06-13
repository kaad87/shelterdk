export interface HubGuide {
  slug: string;
  title: string;
  category: string;
  intro: string | null;
  parent_slug: string | null;
}

/** Hub-grupper i visningsrækkefølge + hvilke kategorier de rummer. */
export const HUB_GROUPS: { group: string; categories: string[] }[] = [
  { group: "Sovegrej", categories: ["sovepose", "liggeunderlag", "haengekoje", "soveudstyr"] },
  { group: "Telte & ly", categories: ["telt", "tarp"] },
  { group: "Belysning", categories: ["pandelampe", "lygte"] },
  { group: "Vand & mad", categories: ["vandfilter", "drikkedunk", "kogeudstyr", "stormkoekken", "frysetorret"] },
  { group: "Værktøj & udstyr", categories: ["kniv", "multitool", "rygsaek", "kikkert", "kompas", "drybag"] },
  { group: "Lejr & komfort", categories: ["campingstol", "campingmobler", "myggenet"] },
  { group: "Tøj & lag-på-lag", categories: ["uldundertoj", "regntoj", "sokker", "fodtoj", "gamacher"] },
];
const OTHER = "Andet";

function groupOf(category: string): string {
  return HUB_GROUPS.find((g) => g.categories.includes(category))?.group ?? OTHER;
}

/** Gruppér guider til hub-sektioner; udelad tomme; bevar HUB_GROUPS-rækkefølge, OTHER til sidst. */
export function groupGuides<T extends HubGuide>(guides: T[]): { group: string; guides: T[] }[] {
  const order = [...HUB_GROUPS.map((g) => g.group), OTHER];
  const byGroup = new Map<string, T[]>();
  for (const guide of guides) {
    const grp = groupOf(guide.category);
    const arr = byGroup.get(grp) ?? [];
    arr.push(guide);
    byGroup.set(grp, arr);
  }
  return order
    .filter((grp) => (byGroup.get(grp)?.length ?? 0) > 0)
    .map((grp) => ({ group: grp, guides: byGroup.get(grp)! }));
}

/**
 * Relaterede guider til "Se også": parent + egne varianter + søskende i samme
 * hub-gruppe. Ekskluderer sig selv. Cappet.
 */
export function relatedGuides<T extends HubGuide>(currentSlug: string, all: T[], cap = 6): T[] {
  const current = all.find((g) => g.slug === currentSlug);
  if (!current) return [];
  const grp = groupOf(current.category);
  const seen = new Set<string>([currentSlug]);
  const out: T[] = [];
  const add = (g: T | undefined) => {
    if (g && !seen.has(g.slug)) {
      seen.add(g.slug);
      out.push(g);
    }
  };
  // 1) parent
  if (current.parent_slug) add(all.find((g) => g.slug === current.parent_slug));
  // 2) egne varianter
  for (const g of all) if (g.parent_slug === currentSlug) add(g);
  // 3) søskende i samme gruppe
  for (const g of all) if (groupOf(g.category) === grp) add(g);
  return out.slice(0, cap);
}
