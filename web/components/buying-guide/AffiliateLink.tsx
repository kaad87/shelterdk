"use client";

import { ExternalLink } from "lucide-react";
import { trackAffiliateClick } from "@/lib/tracking";
import { retailerLabel } from "@/lib/affiliate-retailer";
import type { AffiliateProduct } from "@/lib/affiliate-products";

type P = Pick<
  AffiliateProduct,
  "product_name" | "retailer" | "brand" | "category_mapped" | "price" | "affiliate_url" | "in_stock"
>;

/**
 * Tracket affiliate-CTA til købsguide-flader (overblik + tabel). Fyrer altid
 * trackAffiliateClick (P0: de mest prominente CTA'er var utrackede). Viser
 * "Udsolgt" når varen ikke er på lager. Forhandler-navn i label + aria for tillid/a11y.
 */
export function AffiliateLink({
  product,
  position,
  className,
}: {
  product: P;
  position: "guide_overview" | "guide_table";
  className?: string;
}) {
  if (!product.in_stock) {
    return (
      <span
        className={`block rounded-lg bg-primary/5 px-3 py-1.5 text-center text-xs font-medium text-primary/50 ${className ?? ""}`}
      >
        Udsolgt
      </span>
    );
  }
  const label = `Se pris hos ${retailerLabel(product.retailer)}`;
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="sponsored nofollow noopener"
      aria-label={`${label} — ${product.product_name}`}
      onClick={() =>
        trackAffiliateClick({
          url: product.affiliate_url,
          productName: product.product_name,
          retailer: product.retailer,
          brand: product.brand ?? undefined,
          category: product.category_mapped ?? undefined,
          position,
          priceDkk: typeof product.price === "number" ? product.price : undefined,
        })
      }
      // Mørk baggrund, ikke accent-guld: hvid tekst på #C5A059 giver 2,46:1,
      // under WCAG AA's 4,5:1 ved 12 px. bg-primary giver ~11:1 og er samme
      // mønster som GearCardClient og tilbudskortene allerede bruger — guld
      // beholdes som hover, så accenten stadig markerer handlingen.
      className={`inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent ${className ?? ""}`}
    >
      {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
