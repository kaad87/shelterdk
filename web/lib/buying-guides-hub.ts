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
  { group: "Værktøj & udstyr", categories: ["kniv", "oekse", "multitool", "rygsaek", "kikkert", "kompas", "drybag", "optaending", "elektronik", "vandrestav"] },
  { group: "Lejr & komfort", categories: ["campingstol", "campingmobler", "myggenet", "siddeunderlag"] },
  // Rækkefølgen her er lag-på-lag udefra ind, så gruppen kan læses: baselag,
  // mellemlag, yderlag, ben, fødder, hoved og hænder. Den styrer ikke hvordan
  // guiderne vises (det gør forespørgslen), men den gør hullerne synlige:
  // fleece, dunjakke, vandrebukser, vandresandal og solhat manglede alle fem, og
  // en kategori uden gruppe havner i hub-sidens "Andet" uden søskende-links.
  { group: "Tøj & lag-på-lag", categories: ["uldundertoj", "fleece", "dunjakke", "regntoj", "vandrebukser", "sokker", "fodtoj", "vandresandal", "gamacher", "handsker", "hue", "solhat"] },
  { group: "Sikkerhed & hygiejne", categories: ["foerstehjaelp", "hygiejne"] },
];
/**
 * Gruppe for kategorier der ikke er nævnt ovenfor.
 *
 * Skal i praksis være tom. Da powerbank-, håndklæde- og
 * førstehjælps-guiderne blev oprettet med kategorierne elektronik, hygiejne
 * og foerstehjaelp, faldt alle tre herned — synligt som en navnløs
 * "Andet"-sektion på hub-siden, og usynligt som manglende søskende-links,
 * fordi relatedGuides finder søskende inden for gruppen. scripts/opret_guide.py
 * nægter nu at oprette en guide, hvis dens kategori ikke har en gruppe.
 */
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
 * Kandidaterne i en fast, indholdsuafhængig rækkefølge, roteret så den
 * begynder lige efter den aktuelle guide.
 *
 * Rotationen er hele pointen. Vælger alle guider de samme seks søskende,
 * samler alle interne links sig på seks sider, og resten får nul. Målt på det
 * levende site 26. oktober 2026 havde "Tøj & lag-på-lag" tretten medlemmer,
 * hvoraf dunjakke fik tolv indgående links fra sin egen gruppe, mens solhat,
 * vandrebukser, fleece, gamacher og handsker fik nul.
 *
 * Med en ring peger hver guide på de seks NÆSTE i rækken, og så bliver hver
 * guide selv peget på af præcis seks andre. Fordelingen er jævn uden at nogen
 * skal vedligeholde en liste.
 *
 * Sorteringen er på slug og ikke på updated_at. Listen kom tidligere fra
 * getPublishedGuides, der sorterer efter updated_at faldende, så linkgrafen
 * skiftede, hver gang en guide blev rettet, og samlede sig om det senest
 * redigerede. En graf, der flytter sig af en stavefejl, er ikke en graf man kan
 * bygge på.
 */
function ring<T extends HubGuide>(kandidater: T[], currentSlug: string): T[] {
  const sorteret = [...kandidater].sort((a, b) => a.slug.localeCompare(b.slug, "da"));
  const i = sorteret.findIndex((g) => g.slug === currentSlug);
  if (i < 0) return sorteret;
  return [...sorteret.slice(i + 1), ...sorteret.slice(0, i)];
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
  // 3) søskende i samme gruppe, i ring fra den aktuelle guide
  for (const g of ring(all.filter((x) => groupOf(x.category) === grp), currentSlug)) add(g);

  // 4) fyld op fra hovedguider, hvis gruppen er for lille til at nå loftet.
  //
  // Grupperne er ikke lige store: "Sikkerhed & hygiejne" og "Belysning" har
  // to medlemmer hver, så fire guider fik ét enkelt link og syv af 38 fik
  // under tre — mens loftet er seks. Interne links er sitets største
  // uudnyttede løftestang, så den tomme kapacitet var en reel udeladelse.
  //
  // Der fyldes kun med hovedguider (uden parent_slug). En variant af et andet
  // emne er et svagere link end hovedguiden om samme emne, og den har i
  // forvejen sin forælder som indgang.
  //
  // Også her i ring: uden den blev de samme få hovedguider filler på hver
  // side, og kikkert fik 24 indgående links mens solhat fik nul.
  if (out.length < cap) {
    for (const g of ring(all.filter((x) => !x.parent_slug), currentSlug)) {
      if (out.length >= cap) break;
      add(g);
    }
  }
  return out.slice(0, cap);
}
