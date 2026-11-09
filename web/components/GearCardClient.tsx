"use client";

import { ExternalLink } from "lucide-react";
import type { AffiliateProduct } from "@/lib/affiliate-products";
import { maerketStaarINavnet, rentMaerke, rentNavn } from "@/lib/produktnavn";
import { trackAffiliateClick } from "@/lib/tracking";
import { ProduktBillede } from "@/components/ProduktBillede";
import { retailerNavn } from "@/lib/retailer-navn";

function fireAffiliate(
  product: AffiliateProduct,
  position: "editorial" | "product" | "pill" | "deals_widget"
) {
  trackAffiliateClick({
    url: product.affiliate_url,
    // Sporingen beholder feedets raa navn, saa klikhistorikken i
    // affiliate_clicks grupperer paa samme streng som foer udledningen kom
    // til. Kun det brugeren laeser, skifter navn.
    productName: product.product_name,
    retailer: product.retailer,
    brand: product.brand ?? undefined,
    category: product.category_mapped ?? undefined,
    position,
    priceDkk: typeof product.price === "number" ? product.price : undefined,
  });
}

export type GearCardVariant = "editorial" | "product" | "pill";

function RetailerLabel({ retailer }: { retailer: AffiliateProduct["retailer"] }) {
  return <>{retailerNavn(retailer)}</>;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(n) + " kr";
}

function EditorialVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  const navn = rentNavn(product);
  return (
    <div className={`my-6 flex gap-4 rounded-lg border border-primary/10 border-l-[3px] border-l-accent bg-white p-4 ${className ?? ""}`}>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
        <ProduktBillede src={product.image_url} alt={navn} fill className="object-contain" sizes="96px" />
      </div>
      <div className="min-w-0 flex-1">
        {product.category_mapped && (
          <div className="text-[11px] uppercase tracking-wide text-primary/50">{product.category_mapped}</div>
        )}
        <h4 className="font-serif text-base font-bold text-primary leading-tight">{navn}</h4>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && product.price_original > product.price && product.discount_pct != null && (
            <>
              <span className="text-xs text-primary/40 line-through">{formatPrice(product.price_original)}</span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">–{product.discount_pct}%</span>
            </>
          )}
        </div>
        {outOfStock ? (
          <div className="mt-2 text-sm text-primary/60">Udsolgt lige nu</div>
        ) : (
          <a
            href={product.affiliate_url}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="mt-2 inline-flex items-center gap-1 border-b border-primary pb-px text-sm font-medium text-primary hover:border-accent hover:text-accent"
            onClick={() => fireAffiliate(product, "editorial")}
          >
            Se tilbud hos <RetailerLabel retailer={product.retailer} />
            <ExternalLink size={12} />
          </a>
        )}
        <div className="mt-1 text-[11px] text-primary/40">
          <a href="/annoncer-og-partnere" className="hover:underline">Annonce · Sponsoreret link</a>
        </div>
      </div>
    </div>
  );
}

function ProductVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  const navn = rentNavn(product);
  // Maerket vises kun naar det ikke allerede staar som optakt til navnet.
  // 307 af de 362 varer i publicerede guider gentog det ordret
  // ("Light My Fire" over "Light My Fire FireSteel BIO").
  const maerke = maerketStaarINavnet(rentMaerke(product), navn) ? null : rentMaerke(product);
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] flex flex-row md:flex-col ${className ?? ""}`}>
      {product.discount_pct != null && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-accent-dark px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-bold text-white">
          –{product.discount_pct}%
        </div>
      )}
      <div className="relative w-28 shrink-0 md:w-full md:aspect-square bg-background">
        <ProduktBillede src={product.image_url} alt={navn} fill className="object-contain p-3 md:p-4" sizes="(max-width: 768px) 112px, 33vw" />
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        {maerke && (
          <div className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-accent">{maerke}</div>
        )}
        <h4 className="mt-0.5 md:mt-1 font-serif text-sm md:text-lg font-bold text-primary leading-tight line-clamp-2">{navn}</h4>
        <div className="mt-1.5 md:mt-3 flex items-baseline gap-2">
          <span className="text-base md:text-xl font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && product.price_original > product.price && (
            <span className="text-xs md:text-sm text-primary/40 line-through">{formatPrice(product.price_original)}</span>
          )}
        </div>
        <div className="mt-auto pt-2 md:pt-4">
          {outOfStock ? (
            <div className="flex min-h-11 items-center justify-center rounded-lg bg-primary/5 px-3 md:px-4 py-2 md:py-2.5 text-center text-xs md:text-sm font-medium text-primary/50">Udsolgt lige nu</div>
          ) : (
            <a
              href={product.affiliate_url}
              target="_blank"
              rel="sponsored nofollow noopener"
              // min-h-11 = 44 px: kortet er ikke selv et link, så knappen er
              // det eneste trykmål. Den målte 207×32 px på mobil, under
              // anbefalet minimum. py-2 holdes, så desktop er uændret.
              className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-3 md:px-4 py-2 md:py-2.5 text-center text-xs md:text-sm font-semibold text-white hover:bg-accent"
              onClick={() => fireAffiliate(product, "product")}
            >
              Se tilbud
            </a>
          )}
          <div className="mt-1.5 md:mt-2 text-center text-[10px] md:text-[11px] text-primary/40">
            <a href="/annoncer-og-partnere" className="hover:underline">Hos <RetailerLabel retailer={product.retailer} /> · Annonce</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  const navn = rentNavn(product);
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="sponsored nofollow noopener"
      className={`inline-flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 py-1.5 pl-1.5 pr-3 align-middle text-sm no-underline transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${outOfStock ? "opacity-60" : ""} ${className ?? ""}`}
      aria-label={`Affiliate-link til ${navn}`}
      title="Annonce · Sponsoreret link"
      onClick={() => fireAffiliate(product, "pill")}
    >
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
        <ProduktBillede src={product.image_url} alt="" fill className="object-contain" sizes="32px" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Grej-tip</span>
        <span className="text-[13px] font-semibold text-primary">{navn}</span>
      </span>
      <span className="text-[13px] font-bold text-primary">{formatPrice(product.price)}</span>
      {product.discount_pct != null && (
        <span className="text-[11px] font-bold text-amber-800">–{product.discount_pct}%</span>
      )}
      {outOfStock && <span className="text-[11px] text-primary/50">(udsolgt)</span>}
    </a>
  );
}

/** Client-side view component — all variants. Imported by the GearCard Server Component. */
export function GearCardView({
  product,
  variant,
  className,
}: {
  product: AffiliateProduct;
  variant: GearCardVariant;
  className?: string;
}) {
  if (variant === "editorial") return <EditorialVariant product={product} className={className} />;
  if (variant === "product") return <ProductVariant product={product} className={className} />;
  return <PillVariant product={product} className={className} />;
}
