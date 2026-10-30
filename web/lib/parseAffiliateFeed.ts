import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";
import { FEEDS } from "@/lib/affiliate-feeds";

/**
 * Forhandler-noeglen, udledt af FEEDS frem for skrevet som en union.
 *
 * Var tre literaler skrevet i haanden. Med flere feeds skulle den samme liste
 * vedligeholdes to steder, og en forhandler kunne komme i feed-listen uden at
 * typen kendte den. Nu kan de ikke glide fra hinanden.
 */
export type Retailer = (typeof FEEDS)[number]["retailer"];

export interface NormalizedProduct {
  id: string;
  retailer: Retailer;
  retailer_product_id: string;
  brand: string | null;
  product_name: string;
  description: string | null;
  category_raw: string | null;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  shipping_cost: number | null;
  in_stock: boolean;
  stock_count: number | null;
  image_url: string;
  affiliate_url: string;
  ean: string | null;
}

/**
 * Parses the `lagerantal` field from an affiliate XML feed into a normalized
 * in_stock flag + optional count. Feeds use inconsistent formats:
 * - Backpackerlife: "in stock"
 * - Outdoortid: "in_stock"
 * - Outmore: numeric ("5", "14", "0")
 */
export function parseStockField(raw: string | null | undefined): {
  in_stock: boolean;
  stock_count: number | null;
} {
  if (raw == null) return { in_stock: false, stock_count: null };
  const t = String(raw).trim().toLowerCase();
  if (t === "") return { in_stock: false, stock_count: null };
  if (t === "in stock" || t === "in_stock" || t === "på lager" || t === "pa lager") {
    return { in_stock: true, stock_count: null };
  }
  if (t === "udsolgt" || t === "out of stock" || t === "out_of_stock") {
    return { in_stock: false, stock_count: 0 };
  }
  const n = parseInt(t, 10);
  if (!Number.isNaN(n)) return { in_stock: n > 0, stock_count: n };
  return { in_stock: false, stock_count: null }; // unknown → fail safe OOS
}

/**
 * Returns a rounded integer discount percentage, or null if there's no real
 * discount. Null inputs → null output.
 */
export function calculateDiscountPct(
  price: number,
  priceOriginal: number | null | undefined
): number | null {
  if (priceOriginal == null || priceOriginal <= 0) return null;
  if (price >= priceOriginal) return null;
  return Math.round(((priceOriginal - price) / priceOriginal) * 100);
}

/**
 * Normalizes a single product from a parsed XML feed entry.
 * Returns null if required fields are missing.
 */
export function normalizeProduct(
  raw: Record<string, unknown>,
  retailer: Retailer
): NormalizedProduct | null {
  const retailer_product_id =
    raw.produktid != null ? String(raw.produktid).trim() : "";
  const product_name =
    raw.produktnavn != null ? afkodEntiteter(String(raw.produktnavn).trim()) : "";
  const image_url = raw.billedurl != null ? String(raw.billedurl).trim() : "";
  const affiliate_url = raw.vareurl != null ? String(raw.vareurl).trim() : "";
  const priceStr = raw.nypris != null ? String(raw.nypris).trim() : "";
  const price = parseFloat(priceStr);

  if (
    !retailer_product_id ||
    !product_name ||
    !image_url ||
    !affiliate_url ||
    Number.isNaN(price)
  ) {
    return null;
  }

  const priceOriginalStr = raw.glpris != null ? String(raw.glpris).trim() : "";
  const priceOriginalParsed = parseFloat(priceOriginalStr);
  const price_original = Number.isNaN(priceOriginalParsed)
    ? null
    : priceOriginalParsed;

  const shippingStr = raw.fragtomk != null ? String(raw.fragtomk).trim() : "";
  const shippingParsed = parseFloat(shippingStr);
  const shipping_cost = Number.isNaN(shippingParsed) ? null : shippingParsed;

  const stock = parseStockField(
    raw.lagerantal != null ? String(raw.lagerantal) : null
  );

  return {
    id: `${retailer}-${retailer_product_id}`,
    retailer,
    retailer_product_id,
    brand: raw.brand != null ? String(raw.brand).trim() || null : null,
    product_name,
    description:
      raw.beskrivelse != null
        ? fjernShortcodes(afkodEntiteter(String(raw.beskrivelse).trim())) || null
        : null,
    category_raw:
      raw.kategorinavn != null
        ? String(raw.kategorinavn).trim() || null
        : null,
    price,
    price_original,
    discount_pct: calculateDiscountPct(price, price_original),
    shipping_cost,
    in_stock: stock.in_stock,
    stock_count: stock.stock_count,
    image_url,
    affiliate_url,
    ean: raw.ean != null ? String(raw.ean).trim() || null : null,
  };
}

/**
 * Parses a raw XML buffer into an array of NormalizedProduct.
 * Handles iso-8859-1 decoding (all three feeds declare iso-8859-1 encoding).
 * Skips malformed products silently.
 */
/**
 * UTF-8 der er blevet laest som latin1, laest tilbage til det den var.
 *
 * Feedene erklaerer iso-8859-1 og ER iso-8859-1 for de danske bogstaver:
 * 86.935 raa 0xE6 for "ae" og nul UTF-8-sekvenser for dem. Men enkelte tegn er
 * kommet igennem leverandoerernes systemer to gange og staar nu som de latin1-
 * tegn, UTF-8-bytene svarer til. Maalt paa kataloget: 236 produkter med
 * tobyte-sekvenser ("Â°" for grad, "Â®" for registreret) og 78 med trebyte
 * ("â\u0084¢" for TM, "â\u0080\u0099" for apostrof).
 *
 * Det er ikke kosmetik. Det er temperaturangivelser i soveposebeskrivelser
 * ("-15Â°C"), brandnavnet 66°North og varemaerker i produktnavne.
 *
 * Moensteret foelger UTF-8's egne regler for hvor mange foelgebytes et
 * ledebyte har, saa der ikke spises et tegn for meget. Og resultatet forkastes,
 * hvis det indeholder U+FFFD: var sekvensen ikke rigtig UTF-8, var den aegte
 * latin1-tekst, og saa skal den staa som den gjorde.
 *
 * Foerste udgave kendte kun tobyte-sekvenser, saa "â\u0084¢" slap igennem og
 * stod stadig som tre tegn paa produktkortet.
 */
const MOJIBAKE =
  /[\u00c2-\u00df][\u0080-\u00bf]|[\u00e0-\u00ef][\u0080-\u00bf]{2}|[\u00f0-\u00f4][\u0080-\u00bf]{3}/g;

function retDobbeltkodning(s: string): string {
  return s.replace(MOJIBAKE, (m) => {
    const ud = Buffer.from(m, "latin1").toString("utf8");
    return ud.includes("\ufffd") ? m : ud;
  });
}

/**
 * Fjerner WordPress-shortcodes fra en beskrivelse.
 *
 * Backpackerlifes feed sender beskrivelsen som den staar i deres CMS, og 392
 * produkter begynder med [kad_youtube url="..."]. Den blev vist raa paa
 * koebsguiderne: /bedste/stormkoekken havde teksten "[kad_youtube url=..."
 * staaende midt i et produktkort.
 *
 * Reglen kraever et lighedstegn eller en afsluttende skraastreg i parentesen,
 * saa den rammer shortcodes og ikke almindelig tekst. Der er nul andre
 * firkantparenteser i de 17.047 beskrivelser, men reglen skal ikke kunne spise
 * en "[2 stk]" den dag en forhandler skriver saadan.
 */
const SHORTCODE = /\[\/?[a-z][\w-]*(?:[^\]]*=[^\]]*)?\]/gi;

/**
 * Afkoder HTML-entiteter, der er sluppet igennem som tekst.
 *
 * Outdoor I Centrums feed indeholder "&amp;bull;", og det afkoder XML-parseren
 * korrekt til teksten "&bull;". Leverandoeren har altsaa kodet sin HTML to
 * gange, og resultatet var "&bull; 18 cm savblad" paa et produktkort.
 *
 * Kun en kendt liste plus numeriske entiteter. En ukendt entitet lades staa,
 * for en beskrivelse kan indeholde "&" i al uskyldighed, og en halv afkodning
 * er vaerre end ingen.
 */
const ENTITETER: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  bull: "\u2022", middot: "\u00b7", ndash: "\u2013", mdash: "\u2014",
  hellip: "\u2026", deg: "\u00b0", reg: "\u00ae", trade: "\u2122",
  copy: "\u00a9", frac12: "\u00bd", times: "\u00d7",
};

function afkodEntiteter(s: string): string {
  return s.replace(/&(#\d{2,5}|#x[0-9a-f]{2,4}|[a-zA-Z]{2,10});/gi, (hel, kode: string) => {
    if (kode.startsWith("#x") || kode.startsWith("#X")) {
      return String.fromCodePoint(parseInt(kode.slice(2), 16));
    }
    if (kode.startsWith("#")) return String.fromCodePoint(parseInt(kode.slice(1), 10));
    return ENTITETER[kode.toLowerCase()] ?? hel;
  });
}

function fjernShortcodes(s: string): string {
  return s.replace(SHORTCODE, (m) => (m.includes("=") || m.startsWith("[/") ? "" : m)).trim();
}

export function parseFeedXml(
  buffer: Buffer,
  retailer: Retailer
): NormalizedProduct[] {
  const xmlString = retDobbeltkodning(iconv.decode(buffer, "iso-8859-1"));

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // keep everything as strings; we coerce manually
    trimValues: true,
    isArray: (name) => name === "produkt", // always treat <produkt> as array
    processEntities: {
      enabled: true,
      maxTotalExpansions: 100000, // Backpackerlife feed has many HTML entities in descriptions
    },
    htmlEntities: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlString);
  } catch (err) {
    console.error(`[parseFeedXml] Failed to parse ${retailer} XML:`, err);
    return [];
  }

  // Defensive: if XML is malformed but fast-xml-parser tolerated it, parsed
  // may be missing the expected structure — return empty.
  const produkterNode = (parsed as { produkter?: { produkt?: unknown[] } })
    .produkter;
  if (!produkterNode || !Array.isArray(produkterNode.produkt)) {
    return [];
  }
  const rawProducts = produkterNode.produkt as Record<string, unknown>[];
  const normalized: NormalizedProduct[] = [];

  for (const raw of rawProducts) {
    const n = normalizeProduct(raw, retailer);
    if (n) normalized.push(n);
  }

  return normalized;
}

/* ------------------------------------------------------------------ Awin CSV */

/**
 * Awin leverer CSV, ikke XML, og felterne hedder noget andet. Den her
 * oversaetter til den samme NormalizedProduct, saa resten af synken, udvalget
 * og kategorikaeden ikke behoever at vide, hvilket netvaerk varen kom fra.
 */

/** Én CSV-linje til felter. Respekterer anfoerselstegn og doblede citater. */
export function csvFelter(linje: string): string[] {
  const ud: string[] = [];
  let felt = "";
  let iCitat = false;
  for (let i = 0; i < linje.length; i++) {
    const c = linje[i];
    if (c === '"') {
      if (iCitat && linje[i + 1] === '"') {
        felt += '"';
        i++;
      } else {
        iCitat = !iCitat;
      }
    } else if (c === "," && !iCitat) {
      ud.push(felt);
      felt = "";
    } else {
      felt += c;
    }
  }
  ud.push(felt);
  return ud;
}

/**
 * Prisen kunden betaler, og den foerpris vi vil kendes ved.
 *
 * Her er faelden. Hos Outnorth staar de to priser OMVENDT af Awins
 * konvention: `search_price` er "Vejl. pris", og `custom_1` er den pris, der
 * staar paa knappen. Kontrolleret mod butikkens egne produktsider:
 *
 *   Bergans Flya Insulated Jacket
 *     feed:   search_price 2439,00   custom_1 1220,00
 *     butik:  "discounted price 1 220 kr" / "original price Vejl. pris 2 439 kr"
 *
 * Forholdet mellem de to felter er 1,33 / 1,43 / 1,25 / 1,67 paa tvaers af
 * 58.989 varer, altsaa rene rabattrin paa 25, 30, 20 og 40 %. Havde det vaeret
 * moms eller kostpris, ville tallene ikke ligge paa runde procenter.
 *
 * En almindelig Awin-integration ville have importeret search_price som
 * prisen og vist priser op til 70 % for hoejt.
 *
 * price_original er bevidst ALTID null. Vi KENDER foerprisen, men den er en
 * vejledende udsalgspris og ikke den pris, butikken faktisk solgte til.
 * /black-friday lover, at den kun viser varer med et aegte prisfald, og
 * /tilbud kraever 25 % rabat. Med en vejledende foerpris ville 61 % af
 * kataloget staa som nedsat og fortraenge de andre forhandleres rigtige
 * nedsaettelser. Outnorth er med for sine maerker og sin dybde i guiderne,
 * ikke for at fylde rabat-siderne.
 */
export function awinPris(searchPrice: string, custom1: string): number | null {
  const nu = parseFloat((custom1 ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  const vejl = parseFloat((searchPrice ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isNaN(nu) && nu > 0) return nu;
  if (!Number.isNaN(vejl) && vejl > 0) return vejl;
  return null;
}

/**
 * Parser et Awin-CSV til NormalizedProduct.
 *
 * Beskrivelser og navne er UTF-8 her, ikke iso-8859-1, men de kan have den
 * samme dobbeltkodning som partner-ads-feedene, saa de koeres gennem den
 * samme rettelse.
 */
export function parseFeedCsv(buffer: Buffer, retailer: Retailer): NormalizedProduct[] {
  const tekst = retDobbeltkodning(buffer.toString("utf8"));
  const linjer = tekst.split("\n");
  if (linjer.length < 2) return [];

  const head = csvFelter(linjer[0]).map((h) => h.trim());
  const idx = (navn: string) => head.indexOf(navn);
  const iId = idx("aw_product_id");
  const iLink = idx("aw_deep_link");
  const iNavn = idx("product_name");
  const iPris = idx("search_price");
  const iCustom = idx("custom_1");
  if (iId < 0 || iLink < 0 || iNavn < 0 || iPris < 0) return [];

  const iBillede = idx("merchant_image_url");
  const iBilledeAw = idx("aw_image_url");
  const iBrand = idx("brand_name");
  const iBesk = idx("description");
  const iKat = idx("merchant_category");
  const iEan = idx("ean");
  const iLager = idx("in_stock");
  const iSalg = idx("is_for_sale");

  const ud: NormalizedProduct[] = [];
  for (let n = 1; n < linjer.length; n++) {
    if (!linjer[n].trim()) continue;
    const f = csvFelter(linjer[n]);
    if (f.length < head.length) continue; // afkortet linje, spring over

    const retailer_product_id = (f[iId] ?? "").trim();
    const product_name = (f[iNavn] ?? "").trim();
    const affiliate_url = (f[iLink] ?? "").trim();
    const image_url = ((iBillede >= 0 ? f[iBillede] : "") || (iBilledeAw >= 0 ? f[iBilledeAw] : "") || "").trim();
    const price = awinPris(f[iPris] ?? "", iCustom >= 0 ? f[iCustom] ?? "" : "");

    if (!retailer_product_id || !product_name || !affiliate_url || !image_url || price == null) {
      continue;
    }

    // Outnorth sender in_stock=1 paa hver eneste vare og intet lagerantal, saa
    // feltet er ikke et signal. Varer, der ikke er til salg, ryger ud, og
    // resten regnes paa lager. Synken markerer selv varer, den ikke har set i
    // syv dage, som udsolgt, og det er det reelle lagersignal for det her feed.
    if (iSalg >= 0 && (f[iSalg] ?? "").trim() === "0") continue;
    const in_stock = iLager < 0 || (f[iLager] ?? "1").trim() !== "0";

    ud.push({
      id: `${retailer}-${retailer_product_id}`,
      retailer,
      retailer_product_id,
      brand: iBrand >= 0 ? (f[iBrand] ?? "").trim() || null : null,
      product_name: afkodEntiteter(product_name),
      description: iBesk >= 0 ? fjernShortcodes(afkodEntiteter((f[iBesk] ?? "").trim())) || null : null,
      category_raw: iKat >= 0 ? (f[iKat] ?? "").trim() || null : null,
      price,
      price_original: null, // bevidst. Se awinPris.
      discount_pct: null,
      shipping_cost: null, // Awin-feedet har ingen fragtkolonne med indhold
      in_stock,
      stock_count: null,
      image_url,
      affiliate_url,
      ean: iEan >= 0 ? (f[iEan] ?? "").trim() || null : null,
    });
  }
  return ud;
}
