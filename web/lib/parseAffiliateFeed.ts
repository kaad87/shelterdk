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
