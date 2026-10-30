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
  /**
   * Hvilket netvaerk feedet kommer fra.
   *
   * Udeladt = partner-ads, saa de syv oprindelige linjer staar uroert. Awin
   * er et andet hus: anden adresse, andet skema (CSV, ikke XML) og en
   * API-noegle, der ER hemmelig, i modsaetning til banner- og feed-id.
   * Noeglen staar derfor i env og aldrig her.
   */
  netvaerk?: "partner-ads" | "awin";
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
  /**
   * Hoejere loft for de kategorier, flere guider deler.
   *
   * Loftet er pr. kategori, men flere guider henter fra den SAMME kategori:
   * fire sovepose-guider, tre teltguider, to liggeunderlags-, to fodtoejs- og
   * to kogegrejsguider. Med ét loft paa 20 havde tre teltguider 20 kandidater
   * tilsammen, altsaa under syv hver, og en guide bruger 6-8. Saa kan de ikke
   * vaelge forskelligt, og de kan slet ikke vaelge.
   *
   * Tallene er sat til cirka 15 pr. guide, der kan betjenes. Puljen raekker
   * rigeligt: maalt paa Outnorth-feedet er der 281 soveposemodeller fra 26
   * maerker, 360 telte fra 26 og 531 par fodtoej fra 41, saa loftet var det
   * bindende og ikke feedet.
   *
   * maksPrBrand foelger loftet pr. kategori, saa et hoejere loft ikke bliver
   * tyve af samme maerke.
   */
  loftPrKategoriOverstyring?: Readonly<Record<string, number>>;
  /**
   * Hoejst saa mange modeller fra samme maerke i samme kategori.
   *
   * Udledes af loftet, naar den ikke er sat. Den skal kunne saettes, fordi et
   * specialiseret feed kan vaere forhandler for ét maerke: Zeejuu har 26
   * kikkerter paa lager, og naesten alle er Carson. Den udledte graense paa tre
   * skar kategorien ned til fire varer, altsaa for lidt til en guide, mens
   * graensen i de brede toejfeeds er det der holder Fjällräven fra at fylde
   * tolv af atten vandrebukser.
   */
  maksPrBrand?: number;
}

/**
 * Et nyt feed er en linje her OG en linje i den seneste retailer-migration
 * (migrations/061, udvidet i 062): kolonnen
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
  // To smaa, specialiserede feeds. De er med for hver sin kategori, hvor det
  // eksisterende katalog er for tyndt til en guide: kikkert har fire varer med
  // brugbar tekst, og oekse/sav har syv. Loftet er lavere, fordi feedene er
  // smaa og vi kun skal have nok til én guide pr. kategori.
  { retailer: "zeejuu", label: "Zeejuu.dk", bannerId: "32915", feedId: "266", harBeskrivelser: true, loftPrKategori: 12, maksPrBrand: 8 },
  { retailer: "outdooricentrum", label: "Outdoor I Centrum", bannerId: "117229", feedId: "4361", harBeskrivelser: true, loftPrKategori: 12 },
  // Det foerste Awin-feed, og langt det stoerste: 97.197 varer, altsaa otte
  // gange hele det hidtidige katalog. 99 % har beskrivelse, og det er her de
  // maerker ligger, som guiderne har manglet: Fjällräven, Haglöfs, Arcteryx,
  // Bergans, Lundhags, The North Face, Aclima.
  //
  // Loftet er 20 som i de andre brede feeds. Uden det ville tabellen
  // ottedobles for at daekke de samme kategorier, og 60 % af feedet er
  // loebesko, skiudstyr, hverdagssko og boernetoej, som ingen af vores sider
  // kan bruge.
  {
    retailer: "outnorth", label: "Outnorth.dk", netvaerk: "awin",
    bannerId: "", feedId: "93109", harBeskrivelser: true, loftPrKategori: 20,
    // sovepose: sovepose, -til-vinter, -til-boern og dunsovepose. Boerneguiden
    // kan feedet aldrig betjene, fordi ALDRIG holder boernevarer ude, saa der
    // regnes med tre.
    loftPrKategoriOverstyring: {
      sovepose: 45,
      telt: 45, // telt, familietelt, letvaegtstelt
      liggeunderlag: 30, // liggeunderlag, liggeunderlag-til-vinter
      kogeudstyr: 30, // bestik, stormkoekken
      fodtoj: 30, // vandrestovler, vandresko
    },
  },
] as const satisfies readonly FeedDef[];

/**
 * Kolonnerne vi beder Awin om.
 *
 * Maalt paa Outnorths feed er rrp_price, store_price, base_price, saving,
 * savings_percent, delivery_cost, stock_quantity, stock_status og
 * last_updated TOMME paa alle 97.197 varer, saa de staar ikke her. De ville
 * kun goere hentningen tungere.
 *
 * custom_1 er med, fordi den hos Outnorth rummer den pris kunden betaler.
 * Se AWIN_PRIS i lib/parseAffiliateFeed.ts.
 */
export const AWIN_KOLONNER = [
  "aw_product_id",
  "aw_deep_link",
  "merchant_image_url",
  "aw_image_url",
  "brand_name",
  "merchant_product_id",
  "merchant_category",
  "ean",
  "product_name",
  "description",
  "search_price",
  "custom_1",
  "in_stock",
  "is_for_sale",
  "currency",
] as const;

/**
 * Awins noegle er en hemmelighed og staar i env. Uden den springes feedet
 * over frem for at vaelte hele synken: de seks andre feeds skal koere igennem,
 * ogsaa den dag en noegle udloeber.
 */
export function awinFeedUrl(f: FeedDef, apiKey: string): string {
  const kolonner = AWIN_KOLONNER.join("%2C");
  return `https://productdata.awin.com/datafeed/download/apikey/${apiKey}`
    + `/fid/${f.feedId}/format/csv/language/da/delimiter/%2C`
    + `/compression/gzip/columns/${kolonner}/`;
}

export function feedUrl(f: FeedDef): string {
  return `https://www.partner-ads.com/dk/feed_udlaes.php`
    + `?partnerid=${PARTNER_ID}&bannerid=${f.bannerId}&feedid=${f.feedId}`;
}

const EFTER_NOEGLE = new Map<string, FeedDef>(FEEDS.map((f) => [f.retailer, f]));

export function feedFor(retailer: string): FeedDef | undefined {
  return EFTER_NOEGLE.get(retailer);
}
