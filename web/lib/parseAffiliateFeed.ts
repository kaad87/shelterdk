import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";

export type Retailer = "outmore" | "backpackerlife" | "outdoortid";

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
    raw.produktnavn != null ? String(raw.produktnavn).trim() : "";
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
      raw.beskrivelse != null ? String(raw.beskrivelse).trim() || null : null,
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
export function parseFeedXml(
  buffer: Buffer,
  retailer: Retailer
): NormalizedProduct[] {
  const xmlString = iconv.decode(buffer, "iso-8859-1");

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // keep everything as strings; we coerce manually
    trimValues: true,
    isArray: (name) => name === "produkt", // always treat <produkt> as array
    processEntities: true,
    htmlEntities: true,
    entityExpansionLimit: 50000, // Backpackerlife feed has many entities in descriptions
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
