import type { AffiliateProduct } from "@/lib/affiliate-products";

type P = Pick<AffiliateProduct, "product_name" | "brand" | "image_url" | "price" | "affiliate_url" | "retailer">;

/** JSON-LD Product med offers (pris i DKK). */
export function buildProductSchema(p: P): Record<string, unknown> {
  return {
    "@type": "Product",
    name: p.product_name,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    image: p.image_url,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "DKK",
      availability: "https://schema.org/InStock",
      url: p.affiliate_url,
    },
  };
}

/** JSON-LD ItemList over de rangerede produkter (rich results). */
export function buildItemListSchema(products: P[], pageUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildProductSchema(p),
    })),
  };
}
