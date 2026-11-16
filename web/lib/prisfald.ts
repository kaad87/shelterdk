/**
 * AEGTE PRISFALD: er varen billigere end vi selv har set den?
 *
 * Feedets foer-pris (`price_original`) er butikkens egen paastand, og den kan
 * ikke bruges til at kalde noget et tilbud. Maalt 16. november 2026 mod vores
 * egen historik: af 706 varer feedet kaldte mindst 25 % nedsat, havde 247
 * (35 %) ikke roert sig i pris i de 14 dage vi havde kigget. I guiderne viste
 * 40 kort en rabat vi aldrig havde set opstaa, og de saa ud praecis som de 92
 * hvor prisen faktisk var faldet.
 *
 * Reglen her foelger princippet i prismaerkningsbekendtgoerelsens § 9 a:
 * referenceprisen er den LAVESTE pris i de 30 dage foer nedsaettelsen. Ikke
 * den seneste, ikke den hoejeste, og aldrig butikkens egen.
 *
 * Historikken (`affiliate_price_history`) logger kun AENDRINGER, se
 * scripts/sync-affiliate-products.ts. En vare med én raekke har altsaa haft
 * samme pris siden vi saa den foerste gang, og prisen der gjaldt paa en given
 * dag er den seneste raekke paa eller foer den dag.
 *
 * Tre ting denne fil bevidst IKKE goer:
 *
 *   Den gaetter ikke. Er historikken bagud, for kort eller tom, er svaret
 *   "intet fald". En udateret rabat er ingen rabat.
 *
 *   Den roerer ikke databasen. Feedets raa vaerdier bliver staaende i
 *   `affiliate_products`, saa vi altid kan se hvad butikken paastod.
 *   Erstatningen sker ved laesning, i medPrisfald.
 *
 *   Den rangerer ikke. Guidernes raekkefoelge er redaktionel og maa ikke
 *   foelge med prisen.
 *
 * Filen er REN: ingen database, ingen miljoevariable. Klientkomponenter
 * (GearCardClient) importerer kortDato herfra, saa alt der laeser Supabase
 * ligger i lib/prisfald-opslag.ts.
 */

export interface Prispunkt {
  /** Dato som YYYY-MM-DD. */
  observeret: string;
  price: number;
}

export interface Prisfald {
  /** Laveste pris vi har set i vinduet foer faldet. */
  foer: number;
  nu: number;
  /** Afrundet procent, altid mindst MIN_FALD_PCT. */
  pct: number;
  /** Dagen den nuvaerende pris begyndte, YYYY-MM-DD. */
  siden: string;
}

/** Saa langt tilbage fra faldet leder vi efter den laveste pris. */
export const VINDUE_DAGE = 30;
/**
 * Saa laenge skal vi have set varen FOER faldet. Uden det kan en vare komme
 * ind i kataloget til en oppustet pris og "falde" dagen efter.
 */
export const MIN_DAGE_FOER = 3;
/**
 * Efter saa mange dage er den nye pris bare prisen. Ellers ville et fald fra
 * Black Friday stadig hedde et fald til paaske.
 */
export const MAX_ALDER_DAGE = 30;
/** Mindre end det er stoej, ikke et tilbud. */
export const MIN_FALD_PCT = 5;
/** To synk kan skrive 495 og 495,00 forskelligt. Det er samme pris. */
const TOLERANCE_KR = 0.5;

function dageMellem(fra: string, til: string): number {
  return Math.round((Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000);
}

function dagFoer(dato: string, dage: number): string {
  return new Date(Date.parse(`${dato}T00:00:00Z`) - dage * 86_400_000).toISOString().slice(0, 10);
}

export function idagUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function findPrisfald(
  serie: Prispunkt[],
  nuPris: number,
  idag: string = idagUTC()
): Prisfald | null {
  if (serie.length < 2 || !(nuPris > 0)) return null;
  const s = [...serie].sort((a, b) => a.observeret.localeCompare(b.observeret));

  // Historikken skal ende paa den pris varen har nu. Ellers er den bagud, og
  // saa ved vi ikke hvornaar den nuvaerende pris begyndte.
  const sidste = s[s.length - 1];
  if (Math.abs(sidste.price - nuPris) > TOLERANCE_KR) return null;

  // Start paa det nuvaerende prisforloeb.
  let i = s.length - 1;
  while (i > 0 && Math.abs(s[i - 1].price - sidste.price) <= TOLERANCE_KR) i--;
  if (i === 0) return null;
  const siden = s[i].observeret;

  if (dageMellem(siden, idag) > MAX_ALDER_DAGE) return null;
  if (dageMellem(s[0].observeret, siden) < MIN_DAGE_FOER) return null;

  // Priser der GJALDT i vinduet: alt logget i vinduet, plus den seneste
  // raekke foer vinduet, fordi den pris stadig gjaldt da vinduet begyndte.
  const vindueStart = dagFoer(siden, VINDUE_DAGE);
  const foer = s.slice(0, i);
  const iVinduet = foer.filter((x) => x.observeret >= vindueStart);
  const gjaldtVedStart = [...foer].reverse().find((x) => x.observeret < vindueStart);
  const gaeldende = gjaldtVedStart ? [gjaldtVedStart, ...iVinduet] : iVinduet;
  if (gaeldende.length === 0) return null;

  const ref = Math.min(...gaeldende.map((x) => x.price));
  if (!(ref > 0)) return null;
  const pct = Math.round(((ref - nuPris) / ref) * 100);
  if (pct < MIN_FALD_PCT) return null;
  return { foer: ref, nu: nuPris, pct, siden };
}

/**
 * Erstatter feedets rabat med vores egen, eller fjerner den.
 *
 * Gjort i dataen og ikke i komponenterne, fordi rabatten vises seks steder
 * (PriceTag, tre varianter af GearCard, tilbudsblokken, /tilbud). Rettet ét
 * sted ad gangen ville det syvende sted stadig vise butikkens tal.
 *
 * `prisfald: null` betyder "slaaet op, intet fald". Mangler feltet helt, er
 * varen ikke slaaet op, og `price_original` er stadig feedets.
 */
export function medPrisfald<
  T extends { price: number; price_original: number | null; discount_pct: number | null }
>(vare: T, fald: Prisfald | null): T & { prisfald: Prisfald | null } {
  return {
    ...vare,
    price_original: fald ? fald.foer : null,
    discount_pct: fald ? fald.pct : null,
    prisfald: fald,
  };
}

const MAANEDER = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

/** "2026-11-14" -> "14. nov." Fast tabel, saa Node-versionens locale-data ikke bestemmer teksten. */
export function kortDato(dato: string): string {
  const [, m, d] = dato.split("-").map(Number);
  return `${d}. ${MAANEDER[m - 1]}`;
}
