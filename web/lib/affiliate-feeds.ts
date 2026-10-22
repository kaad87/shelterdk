/**
 * Hvilke feeds vi henter, og hvad vi henter fra dem.
 *
 * Banner- og feed-id staar her og ikke i env. De er ikke hemmelige: de indgaar
 * i hver eneste udgaaende adresse og kan laeses af enhver. Med dem i koden er
 * et nyt feed én linje i en diff i stedet for en indstilling i Netlify, som
 * nogen skal huske at saette ogsaa i preview-miljoeet.
 *
 * Partner-id'et ligger samme sted af samme grund; det staar allerede
 * haardkodet i lib/partner-shelters.ts.
 */

export const PARTNER_ID = "19557";

export interface FeedDef {
  /** Noeglen i databasen og i retailerLabel(). */
  retailer: string;
  /** Visningsnavn. */
  label: string;
  bannerId: string;
  feedId: string;
  /**
   * Har feedet produktbeskrivelser?
   *
   * Maalt paa 22 hentede feeds: elleve leverer tekst paa hver vare, elleve
   * leverer ingen. Outmore er 82 % af kataloget og har nul. Uden tekst kan en
   * guide ikke skrives uden at finde paa indhold, saa feltet er ikke pynt:
   * det afgoer om et feed kan baere en guide.
   */
  harBeskrivelser: boolean;
  /**
   * Hoejst saa mange modeller pr. kategori, og kun fra de kategorier vi har
   * brug for. `null` = importér hele feedet.
   *
   * De tre oprindelige feeds har 5.000-12.000 varer og importeres helt, som de
   * altid har gjort. De to nye har 82.000 tilsammen, og vi bruger 6-8 produkter
   * pr. guide. Uden et loft ville tabellen sekstendobles for at daekke fem nye
   * kategorier. Se lib/feed-udvalg.ts for hvordan udvalget holdes stabilt.
   */
  loftPrKategori: number | null;
}

/**
 * Et nyt feed er en linje her OG en linje i migrations/061: kolonnen
 * affiliate_products.retailer har en check-constraint, der opregner
 * forhandlerne, og en noegle, der ikke staar der, bliver afvist ved import.
 */
export const FEEDS = [
  // De tre oprindelige. Roeres ikke.
  { retailer: "backpackerlife", label: "Backpackerlife.dk", bannerId: "65841", feedId: "1318", harBeskrivelser: true, loftPrKategori: null },
  { retailer: "outdoortid", label: "Outdoortid.dk", bannerId: "103030", feedId: "3079", harBeskrivelser: true, loftPrKategori: null },
  { retailer: "outmore", label: "Outmore.dk", bannerId: "44269", feedId: "565", harBeskrivelser: false, loftPrKategori: null },
  // Nye. Begge leverer beskrivelser paa 100 % af varerne, og de daekker det
  // toej- og fodtoejshul vi ikke kunne fylde: lejrsko, fleece, dunjakke,
  // vandrebukser og solhat.
  { retailer: "prooutdoor", label: "Pro Outdoor", bannerId: "42818", feedId: "523", harBeskrivelser: true, loftPrKategori: 20 },
  { retailer: "outdoornu", label: "Outdoornu.dk", bannerId: "96182", feedId: "2641", harBeskrivelser: true, loftPrKategori: 20 },
] as const satisfies readonly FeedDef[];

export function feedUrl(f: FeedDef): string {
  return `https://www.partner-ads.com/dk/feed_udlaes.php`
    + `?partnerid=${PARTNER_ID}&bannerid=${f.bannerId}&feedid=${f.feedId}`;
}

const EFTER_NOEGLE = new Map<string, FeedDef>(FEEDS.map((f) => [f.retailer, f]));

export function feedFor(retailer: string): FeedDef | undefined {
  return EFTER_NOEGLE.get(retailer);
}
