import { FEED_KATEGORIER, FEED_KATEGORI_MAP } from "./feed-kategori-filter";
import { navneKategorier } from "./kategori-fra-navn";

/**
 * Laeselige navne til kategori-slugs, og den guide hver kategori hoerer til.
 *
 * Laa foer som to haandholdte tabeller inde i /tilbud. De var sejlet: 17 af de
 * 41 kategorier, filteret viser, havde ingen etiket og blev vist som deres
 * slug ("baaludstyr", "taendstaal", "undertoj", "vandresandal"), og seks
 * etiketter pegede paa kategorier, der ikke findes laengere ("bukser",
 * "boern", "cykel", "fiskeri", "hund", "vand"). Krydslinket til koebsguiden
 * fandtes for 11 kategorier, selv om der nu er en guide til 40 af dem.
 *
 * Test'en i __tests__/kategori-labels.test.ts fejler, hvis en kategori, koden
 * selv kan tildele, mangler en etiket. Saa kan tabellen ikke sejle igen: en ny
 * navneregel uden etiket vaelter bygget i stedet for at slippe ud paa sitet.
 */

/** Kategori-slug -> det navn en gaest skal se. */
export const KATEGORI_LABELS: Record<string, string> = {
  baaludstyr: "Bålgrej",
  campingmobler: "Campingmøbler",
  drikkedunk: "Drikkedunke",
  dunjakke: "Dunjakker",
  elektronik: "Elektronik",
  fleece: "Fleece",
  fodtoj: "Fodtøj",
  foerstehjaelp: "Førstehjælp",
  gamacher: "Gamacher",
  haengekoje: "Hængekøjer",
  handsker: "Handsker",
  hue: "Huer og hatte",
  hygiejne: "Hygiejne",
  jakke: "Jakker",
  kikkert: "Kikkerter",
  kniv: "Knive og værktøj",
  kogeudstyr: "Kogeudstyr",
  liggeunderlag: "Liggeunderlag",
  lygte: "Lygter og lanterner",
  mad: "Frysetørret mad",
  myggenet: "Myggenet",
  navigation: "Kompas og navigation",
  oekse: "Økser og save",
  pandelampe: "Pandelamper",
  prepping: "Prepping",
  regntoj: "Regntøj",
  rygsaek: "Rygsække",
  siddeunderlag: "Siddeunderlag",
  sokker: "Sokker",
  solhat: "Solhatte",
  sovepose: "Soveposer",
  soveudstyr: "Soveudstyr",
  taendstaal: "Tændstål",
  tarp: "Tarps",
  taske: "Tasker og dry bags",
  telt: "Telte",
  undertoj: "Uldundertøj",
  vandfilter: "Vandfiltre",
  vandrebukser: "Vandrebukser",
  vandresandal: "Vandresandaler",
  vandrestav: "Vandrestave",
};

/**
 * Kategori-slug -> koebsguiden om den slags grej.
 *
 * Etiketten her er den boejning, der passer i "vores guide til de bedste X",
 * saa saetningen laeses rigtigt uden at skulle bygges af kategorinavnet.
 * baaludstyr staar bevidst ikke paa listen: der er ingen baal-guide endnu.
 */
export const KATEGORI_GUIDE: Record<string, { slug: string; label: string }> = {
  campingmobler: { slug: "campingstol", label: "campingstole" },
  drikkedunk: { slug: "drikkedunk", label: "drikkedunke" },
  dunjakke: { slug: "dunjakke", label: "dunjakker" },
  elektronik: { slug: "powerbank", label: "powerbanks" },
  fleece: { slug: "fleece", label: "fleecetrøjer" },
  fodtoj: { slug: "vandrestovler", label: "vandrestøvler" },
  foerstehjaelp: { slug: "foerstehjaelp", label: "førstehjælpstasker" },
  gamacher: { slug: "gamacher", label: "gamacher" },
  haengekoje: { slug: "haengekoje", label: "hængekøjer" },
  handsker: { slug: "handsker", label: "handsker" },
  hue: { slug: "hue", label: "huer" },
  hygiejne: { slug: "haandklaede", label: "mikrofiberhåndklæder" },
  jakke: { slug: "dunjakke", label: "dunjakker" },
  kikkert: { slug: "kikkert", label: "kikkerter" },
  kniv: { slug: "kniv", label: "knive" },
  kogeudstyr: { slug: "stormkoekken", label: "stormkøkkener" },
  liggeunderlag: { slug: "liggeunderlag", label: "liggeunderlag" },
  lygte: { slug: "lanterne", label: "lanterner" },
  mad: { slug: "frysetorret-mad", label: "frysetørrede måltider" },
  myggenet: { slug: "myggenet", label: "myggenet" },
  navigation: { slug: "kompas", label: "kompasser" },
  oekse: { slug: "oekse", label: "økser og save" },
  pandelampe: { slug: "pandelampe", label: "pandelamper" },
  prepping: { slug: "taendstaal", label: "tændstål" },
  regntoj: { slug: "regntoj", label: "regnjakker" },
  rygsaek: { slug: "vandrerygsaek", label: "vandrerygsække" },
  siddeunderlag: { slug: "siddeunderlag", label: "siddeunderlag" },
  sokker: { slug: "vandresokker", label: "vandresokker" },
  solhat: { slug: "solhat", label: "solhatte" },
  sovepose: { slug: "sovepose", label: "soveposer" },
  soveudstyr: { slug: "sovepude", label: "sovepuder" },
  taendstaal: { slug: "taendstaal", label: "tændstål" },
  tarp: { slug: "tarp", label: "tarps" },
  taske: { slug: "dry-bag", label: "dry bags" },
  telt: { slug: "telt", label: "telte" },
  undertoj: { slug: "uldundertoj", label: "uldundertøj" },
  vandfilter: { slug: "vandfilter", label: "vandfiltre" },
  vandrebukser: { slug: "vandrebukser", label: "vandrebukser" },
  vandresandal: { slug: "vandresandal", label: "vandresandaler" },
  vandrestav: { slug: "vandrestav", label: "vandrestave" },
};

/** Etiketten, eller sluggen selv hvis den mangler. Sitet maa ikke gaa i stykker. */
export function kategoriLabel(kategori: string): string {
  return KATEGORI_LABELS[kategori] ?? kategori;
}

/** Alle kategorier koden selv kan skrive paa en vare. Bruges af test'en. */
export function kodeKategorier(): string[] {
  const fraOpslag = Object.values(FEED_KATEGORI_MAP).flatMap((kort) => Object.values(kort));
  return [
    ...new Set([...FEED_KATEGORIER.map((k) => k.kategori), ...fraOpslag, ...navneKategorier()]),
  ].sort();
}
