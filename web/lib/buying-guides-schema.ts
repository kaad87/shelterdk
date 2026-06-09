import type { AffiliateProduct } from "@/lib/affiliate-products";

type P = Pick<AffiliateProduct, "product_name" | "brand" | "image_url" | "price" | "affiliate_url" | "retailer">;

/**
 * JSON-LD Product med offers (pris i DKK). Hvis `score` (0-10) er sat, tilføjes
 * et redaktionelt Review (forfattet af ShelterDK) → review-stjerner i Google.
 * Kun for tredjeparts-produkter (grej), jf. Googles guidelines.
 */
export function buildProductSchema(p: P, score?: number | null): Record<string, unknown> {
  return {
    "@type": "Product",
    name: p.product_name,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    image: p.image_url,
    ...(score != null
      ? {
          review: {
            "@type": "Review",
            author: { "@type": "Organization", name: "ShelterDK" },
            reviewRating: { "@type": "Rating", ratingValue: score, bestRating: 10, worstRating: 0 },
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "DKK",
      availability: "https://schema.org/InStock",
      url: p.affiliate_url,
    },
  };
}

/** JSON-LD ItemList over de rangerede produkter (rich results), med score pr. produkt. */
export function buildItemListSchema(
  items: { product: P; score?: number | null }[],
  pageUrl: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildProductSchema(it.product, it.score),
    })),
  };
}
