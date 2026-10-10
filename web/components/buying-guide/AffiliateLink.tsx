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
      // accent-dark #8A6A26: 5,04:1 med hvid tekst, altså over WCAG AA's 4,5:1
      // — og stadig guld. Den oprindelige accent #C5A059 gav 2,46:1 og bestod
      // ikke. Mellemliggende forsøg med bg-primary gav 10,98:1, men tallene
      // efter udrulningen pegede på at knappen holdt op med at ligne en knap:
      // konverteringen på denne flade og tabellen faldt fra 39,2% til 26,3% af
      // trafikken, mens den urørte product-flade steg fra 6,9% til 12,3%.
      // Ikke statistisk sikkert (p≈0,09), men accentfarven bærer "her handler
      // du" i det her designsystem, og accent-dark giver begge dele.
      // Kontrastkravet er låst i lib/__tests__/cta-kontrast.test.ts.
      className={`inline-flex items-center justify-center gap-1 rounded-lg bg-accent-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark/90 ${className ?? ""}`}
    >
      {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
