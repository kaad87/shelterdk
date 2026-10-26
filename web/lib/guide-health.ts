/**
 * Sundhedstjek pr. købsguide — bruges i admin.
 *
 * Findes fordi 37 af 194 produktpladser nåede at dø, uden at nogen kunne se
 * det uden at åbne hver guide for sig. Frontenden skjuler nu konsekvenserne
 * (udsolgte mister prædikat og demoteres), men det er stadig tabte pladser,
 * og det skal være synligt ét sted.
 */

export interface HealthEntry {
  inStock: boolean;
  isBlocked: boolean;
  /** Sidst set i forhandlerens feed. Gammel dato = varen er afmeldt, ikke bare udsolgt. */
  lastSeenAt: string | null;
  awardLabel: string | null;
  /** Hvem varen købes hos. Afgør om guiden har mere end ét svigtpunkt. */
  retailer: string | null;
}

import { ALDRIG, guidenHandlerOmBoern } from "./feed-kategori-filter";

export interface HealthInput {
  slug: string;
  lastReviewedAt: string | null;
  entries: HealthEntry[];
  /**
   * Titel og beskrivelse, så vi kan se om deres tal-påstande faktisk kan
   * holdes friske. Valgfrie, fordi ældre kaldere ikke sender dem — men uden
   * dem kan tjekket nedenfor ikke køre.
   */
  seoTitle?: string | null;
  seoDescription?: string | null;
  /**
   * Broedteksten og navnene paa de varer, der faktisk ligger paa siden, saa
   * tjekket nedenfor kan se om teksten anbefaler noget, der er taget ud.
   * Valgfrie: aeldre kaldere sender dem ikke, og saa springes tjekket over.
   */
  bodyMd?: string | null;
  /** Produktnavn + maerke pr. entry, i vilkaarlig raekkefoelge. */
  entryNames?: string[];
  /**
   * Maerkenavne fra hele kataloget, ikke kun fra denne guide.
   *
   * Noedvendig, og det kostede tre forsoeg at indse. Husets stil bruger fed
   * skrift baade til produktnavne ("**Outwell Tidal**") og til begreber midt i
   * en saetning ("**Vaegt og pakmaal**", "**Blackout-stof**"), og hverken
   * tegnsaetning eller linjeplacering kan skelne dem. Et kendt maerkenavn kan.
   *
   * Og den skal komme fra KATALOGET og ikke fra guidens egne varer: det
   * tilfaelde tjekket findes for er netop et maerke, der er helt ude af
   * guiderne, men stadig anbefales i prosaen.
   */
  knownBrands?: string[];
}

/**
 * Et praedikat der udpeger varen som guidens boernevalg.
 *
 * "Bedste til boern" og "Bedste til stoerre boern" er de faktiske vaerdier.
 */
const BOERNE_PRAEDIKAT = /børn|boern|junior|barn/i;

/**
 * UTILSIGTEDE boerne- og hundeprodukter i en guide, der ikke handler om dem.
 *
 * Feed-filteret har et ALDRIG-vaern mod netop det, men det koerer kun paa de
 * filtrerede feeds. Backpackerlife, Outmore og Outdoortid importeres helt, saa
 * en boernevare kan naa ind i en voksenguide uden at noget siger fra.
 *
 * FOERSTE UDGAVE meldte alle seks boernevarer i voksenguider som fejl, og alle
 * seks var bevidste: en Nalgene Kids-drikkedunk, boernegamacher, en Tatonka
 * Junior, en Black Diamond Wiz, en Coghlans Poncho For Kids og en Merrell Kids
 * Moab. De baerer hver et praedikat ("Bedste til boern"), en redaktionel note
 * der forklarer valget, og ulemper der siger "For svag til voksenbrug". Det er
 * en familie-vinkel i en voksenguide og ikke en fejl, saa checket gav seks
 * falske positive og ville have sendt vagtjobbet i gang hver nat.
 *
 * Praedikatet er derfor det, der skiller: en boernevare NOGEN har udpeget som
 * boernevalget er bevidst, en uden er en forglemmelse.
 *
 * Guiden selv kan ogsaa handle om boern: /bedste/sovepose-til-boern SKAL have
 * boernesoveposer, og den kendes paa sin slug og paa at flertallet af dens egne
 * navne er boernevarer.
 */
function findChildItems(input: HealthInput): string[] {
  const navne = input.entryNames ?? [];
  if (!navne.length) return [];
  if (guidenHandlerOmBoern(input.slug, navne)) return [];
  // entryNames og entries bygges i samme raekkefoelge, saa de parres paa indeks.
  return navne
    .map((n, i) => ({ navn: n, praedikat: input.entries[i]?.awardLabel ?? null }))
    .filter((x) => ALDRIG.test(x.navn) && !BOERNE_PRAEDIKAT.test(x.praedikat ?? ""))
    .map((x) => x.navn.trim().slice(0, 60));
}

export interface GuideHealth {
  slug: string;
  total: number;
  /** Produkter der ikke kan købes lige nu. */
  dead: number;
  /** Produkter der har været ude af feedet i over 30 dage — kommer næppe igen. */
  delisted: number;
  /** Forhandleren med flest købbare varer i guiden, eller null hvis ingen er oplyst. */
  topRetailer: string | null;
  /** Dennes andel af de købbare varer, 0-1. */
  topRetailerShare: number;
  /** Hvor mange købbare varer der ville være tilbage, hvis den forhandler forsvandt. */
  survivesTopRetailerLoss: number;
  /** Om siden kan vise et førstevalg — se resolveAwards i buying-guides.ts. */
  canShowTopAward: boolean;
  /** Andelen er over MAX_RETAILER_SHARE. Rapporteres, men alarmerer ikke. */
  concentrationRisk: boolean;
  /**
   * Guiden ville stå med under MIN_SURVIVORS varer, hvis den største
   * forhandler forsvandt — altså i eller tæt på campingstols tilstand.
   * Rapporteres; alarmerer ikke, men er det efterslæb der skal lukkes først.
   */
  singleRetailerRisk: boolean;
  /** Produktnavne broedteksten anbefaler, men som ikke er paa siden. */
  staleBrands: string[];
  /** Boerne- eller hundeprodukter i en guide der ikke handler om dem. */
  childItems: string[];
  problems: string[];
}

/**
 * En tal-påstand om favoritter, som friskTitel/friskBeskrivelse kan vedligeholde.
 *
 * Samme mønster som ANTAL i guide-title.ts, og det er hele pointen: nævner en
 * tekst favoritter uden et ciffer, matcher friskhedsmodulet den ikke, og
 * påstanden kan aldrig rettes. Tre guider stod sådan — "Vi scorer favoritter
 * — LifeStraw, Katadyn og kemisk rensning" — hvilket både læser forkert og
 * er usynligt for maskineriet. Det er en tavs tilstand, så den skal meldes.
 */
const FAVORIT_UDEN_TAL = /favorit/i;
const FAVORIT_MED_TAL = /\d+\s+favorit(?:ter)?/i;

function tallosPaastand(tekst: string | null | undefined): boolean {
  if (!tekst) return false;
  return FAVORIT_UDEN_TAL.test(tekst) && !FAVORIT_MED_TAL.test(tekst);
}

const MIN_BUYABLE = 4;
const DELISTED_DAYS = 30;
const REVIEW_DAYS = 120;

/**
 * Hvor stor en del af en guide én forhandler må stå for.
 *
 * Frafald er ikke uafhængigt. Campingstol-guiden døde ikke af slid: den havde
 * fem af fem varer hos outmore, og da hele Easy Camp/Outwell-rækken forsvandt
 * ud af feedet, forsvandt guiden på én gang. Målt bagefter havde 20 af 30
 * guider samtlige produkter hos én forhandler — altså tyve gentagelser af det
 * samme enkelte svigtpunkt.
 *
 * Grænsen måles kun på det der kan købes. En guide, hvor den store forhandlers
 * varer allerede er udsolgte, hænger reelt på den lille.
 *
 * Koncentration står med vilje IKKE i `problems`. 24 af 30 guider overskrider
 * grænsen, og et dagligt varsel om dem alle bliver slået fra inden for en uge
 * — hvorefter det heller ikke fanger det akutte. Koncentration er en
 * efterslæbs-opgave man løser redaktionelt, ikke en alarm.
 */
const MAX_RETAILER_SHARE = 0.6;

/**
 * Hvor mange varer der mindst skal være tilbage, hvis den største forhandler
 * forsvinder.
 *
 * Andelen alene er den forkerte målestok. At bringe alle 24 koncentrerede
 * guider under 60% kræver 93 nye produkter, næsten en fordobling, og det
 * støder mod at backpackerlife foretrækkes i kuraterede lister — de står for
 * 72% af affiliate-klikkene.
 *
 * Det der faktisk gik galt med campingstol var ikke en høj andel, men at der
 * stod NUL tilbage: siden viste 19 "Udsolgt" og ingen købsknap. En guide der
 * overlever med to varer er aldrig i den tilstand, og det svækkede tilfælde
 * fanger `MIN_BUYABLE` dagen efter. To er derfor gulvet, og det koster 10
 * produkter i stedet for 93.
 */
const MIN_SURVIVORS = 2;

/** Samme liste som TOP_AWARDS i buying-guides.ts, hvor prædikatet uddeles. */
const TOP_AWARD = /^(?:vores valg|bedst i test|testvinder|redaktionens valg)$/i;

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (now.getTime() - t) / 86_400_000;
}

/**
 * Produktnavne i broedteksten, der ikke findes blandt sidens varer.
 *
 * Et fed-markeret maerkenavn er en anbefaling, og den skal kunne koebes paa
 * siden. Et maerke i parentes er markedskontekst: "standard-tarps i polyester
 * (Robens, Easy Camp, Tatonka) vejer 700-1.200 gram" lover ikke at siden
 * saelger en Robens, saa kun fed skrift taeller.
 *
 * Der sammenlignes paa hele ord, saa "Keen" ikke rammer "keenness".
 */
function findStaleBrands(input: HealthInput): string[] {
  if (!input.bodyMd || !input.entryNames?.length || !input.knownBrands?.length) {
    return [];
  }
  const paaSiden = input.entryNames.join(" ").toLowerCase();
  const fede = [...input.bodyMd.matchAll(/\*\*([^*\n]{3,80})\*\*/g)]
    .map((m) => m[1].toLowerCase());
  if (!fede.length) return [];

  const ud = new Set<string>();
  for (const maerke of input.knownBrands) {
    const m = maerke.trim();
    if (m.length < 4) continue;
    const lav = m.toLowerCase();
    if (paaSiden.includes(lav)) continue;
    const graense = new RegExp(`(^|[^\\p{L}\\p{N}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
    if (fede.some((f) => graense.test(f))) ud.add(m);
  }
  return [...ud].sort();
}

export function guideHealth(input: HealthInput, now: Date = new Date()): GuideHealth {
  const dead = input.entries.filter((e) => !e.inStock || e.isBlocked);
  const levende = input.entries.filter((e) => e.inStock && !e.isBlocked);
  const buyable = levende.length;
  // En manglende dato er ikke "set i dag". Varen har aldrig været i et feed,
  // eller tidsstemplet er tabt, og begge er værre end en gammel dato — så den
  // tæller som afmeldt frem for som den friskeste i guiden.
  const delisted = dead.filter((e) => (daysSince(e.lastSeenAt, now) ?? Infinity) > DELISTED_DAYS);

  const pr = new Map<string, number>();
  for (const e of levende) {
    if (!e.retailer) continue;
    pr.set(e.retailer, (pr.get(e.retailer) ?? 0) + 1);
  }
  const [topRetailer, topAntal] =
    [...pr].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [null, 0];
  const medForhandler = [...pr.values()].reduce((a, b) => a + b, 0);
  const topRetailerShare = medForhandler > 0 ? topAntal / medForhandler : 0;

  // Kun varer vi kender forhandleren på kan tælles som overlevere. Tidligere
  // var det `buyable - topAntal`, men buyable rummer også varer uden
  // forhandler, som springes over i optællingen ovenfor. En guide med tre hos
  // backpackerlife og to uden oplyst forhandler blev derfor meldt til at have
  // to overlevere — skønt de to lige så godt kan ligge hos backpackerlife.
  // Et ukendt svigtpunkt er ikke et sikret svigtpunkt.
  const survivesTopRetailerLoss = medForhandler - topAntal;

  // resolveAwards giver topprædikatet til den højest scorende vare på lager
  // uden prædikat. Bærer en vare på lager det allerede, er alt godt; ellers
  // skal der findes én uden prædikat, der kan arve det. Mangler begge, står
  // siden uden førstevalg — og svarkapslen udnævner ellers altid et.
  const canShowTopAward =
    levende.some((e) => TOP_AWARD.test((e.awardLabel ?? "").trim())) ||
    levende.some((e) => !e.awardLabel);

  // Maerker som broedteksten anbefaler, men som ikke laengere er paa siden.
  //
  // Findes fordi /bedste/campingstol i oktober 2026 havde et afsnit "Vores
  // anbefaling", der udpegede Outwell Catamarca, Sea to Summit Air Chair og
  // Outwell Tidal. Ingen af dem var paa siden: to entries var fjernet og én
  // erstattet, uden at prosaen fulgte med. Siden havde flest visninger af alle
  // guider og tredjelavest CTR. Det samme gjaldt tarp, taendstaal og
  // frysetorret-mad.
  //
  // Kun FED skrift taeller. Et maerke i fed er en anbefaling; et i parentes er
  // markedskontekst, og "standard-tarps i polyester (Robens, Easy Camp,
  // Tatonka) vejer 700-1.200 gram" lover ikke at siden saelger en Robens.
  const staleBrands = findStaleBrands(input);
  const childItems = findChildItems(input);

  const problems: string[] = [];
  if (childItems.length) {
    problems.push(
      `${childItems.length} boerne- eller hundeprodukt(er) i en voksenguide: ${childItems.join(", ")}`
    );
  }
  if (staleBrands.length) {
    problems.push(
      `teksten anbefaler ${staleBrands.join(", ")}, som ikke er paa siden`
    );
  }
  if (buyable < MIN_BUYABLE) problems.push(`kun ${buyable} produkter kan købes`);
  if (buyable > 0 && !canShowTopAward) {
    problems.push("siden kan ikke vise et førstevalg — alle varer på lager har allerede et prædikat");
  }
  if (delisted.length) problems.push(`${delisted.length} produkt(er) afmeldt fra feedet i over ${DELISTED_DAYS} dage`);
  for (const [hvad, tekst] of [
    ["titlen", input.seoTitle],
    ["beskrivelsen", input.seoDescription],
  ] as const) {
    if (tallosPaastand(tekst)) {
      problems.push(`${hvad} nævner favoritter uden et tal — friskhedsmodulet kan ikke rette den`);
    }
  }
  const reviewAge = daysSince(input.lastReviewedAt, now);
  if (reviewAge == null) problems.push("aldrig gennemgået");
  else if (reviewAge > REVIEW_DAYS) problems.push(`gennemgået for ${Math.round(reviewAge)} dage siden`);

  return {
    slug: input.slug,
    total: input.entries.length,
    dead: dead.length,
    delisted: delisted.length,
    topRetailer,
    topRetailerShare,
    survivesTopRetailerLoss,
    canShowTopAward,
    concentrationRisk: topRetailer != null && topRetailerShare > MAX_RETAILER_SHARE,
    singleRetailerRisk: topRetailer != null && buyable > 0 && survivesTopRetailerLoss < MIN_SURVIVORS,
    staleBrands,
    childItems,
    problems,
  };
}
