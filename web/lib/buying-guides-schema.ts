import type { AffiliateProduct } from "@/lib/affiliate-products";

type P = Pick<
  AffiliateProduct,
  "product_name" | "brand" | "image_url" | "price" | "affiliate_url" | "retailer" | "in_stock"
>;

export interface ProductSchemaOpts {
  /** Redaktionel score 0-10 → Review med stjerner. */
  score?: number | null;
  /** Redaktionelle plusser → review.positiveNotes (pros/cons i SERP). */
  pros?: string[];
  /** Redaktionelle minusser → review.negativeNotes. */
  cons?: string[];
  /** Redaktionel note → review.reviewBody. */
  reviewBody?: string | null;
}

/**
 * Feeds har ofte intet brand-felt — brandet står i produktnavnet
 * ("Sovepose - Treklife Peak 4S"). Konservativ inferens mod kendte mærker;
 * null hvis intet sikkert match (hellere udeladt end forkert).
 */
const KNOWN_BRANDS = [
  "Sea to Summit",
  "High Peak",
  "Black Diamond",
  "Easy Camp",
  "Therm-a-Rest",
  "Treklife",
  "Highlander",
  "Snugpak",
  "Nordisk",
  "Trespass",
  "Opinel",
  "Carinthia",
  "Klymit",
  "Nemo",
  "Robens",
  "Outwell",
  "Vango",
  "Petzl",
  "Ledlenser",
  "Exped",
  "Katadyn",
  "LifeStraw",
  "Morakniv",
  "Mora",
  "Helikon-Tex",
];

export function inferBrandFromName(productName: string): string | null {
  for (const brand of KNOWN_BRANDS) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[\\s\\-–])${escaped}([\\s\\-–]|$)`, "i").test(productName)) {
      return brand;
    }
  }
  return null;
}

function notesList(notes: string[]): Record<string, unknown> {
  return {
    "@type": "ItemList",
    itemListElement: notes.map((name, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
    })),
  };
}

/** Rullende gyldighed: priser synces dagligt + ISR, 30 dage er konservativt. */
function priceValidUntil(): string {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

/**
 * JSON-LD Product med offers (pris i DKK, ærlig lagerstatus). Hvis `score`
 * (0-10) er sat, tilføjes et redaktionelt Review (forfattet af ShelterDK) med
 * pros/cons som positiveNotes/negativeNotes → review-stjerner og +/− i Google.
 * Kun for tredjeparts-produkter (grej), jf. Googles guidelines.
 */
export function buildProductSchema(p: P, opts: ProductSchemaOpts = {}): Record<string, unknown> {
  const { score, pros, cons, reviewBody } = opts;
  const brand = p.brand || inferBrandFromName(p.product_name);
  return {
    "@type": "Product",
    name: p.product_name,
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    image: p.image_url,
    ...(score != null
      ? {
          review: {
            "@type": "Review",
            author: { "@type": "Organization", name: "ShelterDK" },
            reviewRating: { "@type": "Rating", ratingValue: score, bestRating: 10, worstRating: 0 },
            ...(reviewBody ? { reviewBody } : {}),
            ...(pros && pros.length > 0 ? { positiveNotes: notesList(pros) } : {}),
            ...(cons && cons.length > 0 ? { negativeNotes: notesList(cons) } : {}),
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "DKK",
      priceValidUntil: priceValidUntil(),
      availability: p.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: p.affiliate_url,
    },
  };
}

/** JSON-LD ItemList over de rangerede produkter (rich results), med review pr. produkt. */
export function buildItemListSchema(
  items: { product: P; score?: number | null; pros?: string[]; cons?: string[]; reviewBody?: string | null }[],
  pageUrl: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildProductSchema(it.product, {
        score: it.score,
        pros: it.pros,
        cons: it.cons,
        reviewBody: it.reviewBody,
      }),
    })),
  };
}
