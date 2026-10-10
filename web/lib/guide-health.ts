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

export interface HealthInput {
  slug: string;
  lastReviewedAt: string | null;
  entries: HealthEntry[];
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
  problems: string[];
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

export function guideHealth(input: HealthInput, now: Date = new Date()): GuideHealth {
  const dead = input.entries.filter((e) => !e.inStock || e.isBlocked);
  const levende = input.entries.filter((e) => e.inStock && !e.isBlocked);
  const buyable = levende.length;
  const delisted = dead.filter((e) => (daysSince(e.lastSeenAt, now) ?? 0) > DELISTED_DAYS);

  const pr = new Map<string, number>();
  for (const e of levende) {
    if (!e.retailer) continue;
    pr.set(e.retailer, (pr.get(e.retailer) ?? 0) + 1);
  }
  let topRetailer: string | null = null;
  let topAntal = 0;
  for (const [navn, n] of [...pr].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    topRetailer = navn;
    topAntal = n;
    break;
  }
  const medForhandler = [...pr.values()].reduce((a, b) => a + b, 0);
  const topRetailerShare = medForhandler > 0 ? topAntal / medForhandler : 0;
  const survivesTopRetailerLoss = buyable - topAntal;

  // resolveAwards giver topprædikatet til den højest scorende vare på lager
  // uden prædikat. Bærer en vare på lager det allerede, er alt godt; ellers
  // skal der findes én uden prædikat, der kan arve det. Mangler begge, står
  // siden uden førstevalg — og svarkapslen udnævner ellers altid et.
  const canShowTopAward =
    levende.some((e) => TOP_AWARD.test((e.awardLabel ?? "").trim())) ||
    levende.some((e) => !e.awardLabel);

  const problems: string[] = [];
  if (buyable < MIN_BUYABLE) problems.push(`kun ${buyable} produkter kan købes`);
  if (buyable > 0 && !canShowTopAward) {
    problems.push("siden kan ikke vise et førstevalg — alle varer på lager har allerede et prædikat");
  }
  if (delisted.length) problems.push(`${delisted.length} produkt(er) afmeldt fra feedet i over ${DELISTED_DAYS} dage`);
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
    problems,
  };
}
