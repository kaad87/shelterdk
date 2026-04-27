"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { AffiliateProduct } from "@/lib/affiliate-products";
import { trackOutboundClick } from "@/lib/tracking";

export type GearCardVariant = "editorial" | "product" | "pill";

function RetailerLabel({ retailer }: { retailer: AffiliateProduct["retailer"] }) {
  const labels = {
    outmore: "Outmore.dk",
    backpackerlife: "Backpackerlife.dk",
    outdoortid: "Outdoortid.dk",
  };
  return <>{labels[retailer]}</>;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(n) + " kr";
}

function EditorialVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  return (
    <div className={`my-6 flex gap-4 rounded-lg border border-primary/10 border-l-[3px] border-l-accent bg-white p-4 ${className ?? ""}`}>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
        <Image src={product.image_url} alt={product.product_name} fill className="object-contain" sizes="96px" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        {product.category_mapped && (
          <div className="text-[11px] uppercase tracking-wide text-primary/50">{product.category_mapped}</div>
        )}
        <h4 className="font-serif text-base font-bold text-primary leading-tight">{product.product_name}</h4>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && product.discount_pct != null && (
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
            onClick={() => trackOutboundClick(product.affiliate_url, `${product.product_name} [editorial]`)}
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
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] flex flex-row md:flex-col ${className ?? ""}`}>
      {product.discount_pct != null && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-accent px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-bold text-white">
          –{product.discount_pct}%
        </div>
      )}
      <div className="relative w-28 shrink-0 md:w-full md:aspect-square bg-background">
        <Image src={product.image_url} alt={product.product_name} fill className="object-contain p-3 md:p-4" sizes="(max-width: 768px) 112px, 33vw" unoptimized />
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        {product.brand && (
          <div className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-accent">{product.brand}</div>
        )}
        <h4 className="mt-0.5 md:mt-1 font-serif text-sm md:text-lg font-bold text-primary leading-tight line-clamp-2">{product.product_name}</h4>
        <div className="mt-1.5 md:mt-3 flex items-baseline gap-2">
          <span className="text-base md:text-xl font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && (
            <span className="text-xs md:text-sm text-primary/40 line-through">{formatPrice(product.price_original)}</span>
          )}
        </div>
        <div className="mt-auto pt-2 md:pt-4">
          {outOfStock ? (
            <div className="rounded-lg bg-primary/5 px-3 md:px-4 py-2 md:py-2.5 text-center text-xs md:text-sm font-medium text-primary/50">Udsolgt lige nu</div>
          ) : (
            <a
              href={product.affiliate_url}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="block rounded-lg bg-primary px-3 md:px-4 py-2 md:py-2.5 text-center text-xs md:text-sm font-semibold text-white hover:bg-accent"
              onClick={() => trackOutboundClick(product.affiliate_url, `${product.product_name} [product]`)}
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
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="sponsored nofollow noopener"
      className={`inline-flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 py-1.5 pl-1.5 pr-3 align-middle text-sm no-underline transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${outOfStock ? "opacity-60" : ""} ${className ?? ""}`}
      aria-label={`Affiliate-link til ${product.product_name}`}
      title="Annonce · Sponsoreret link"
      onClick={() => trackOutboundClick(product.affiliate_url, `${product.product_name} [pill]`)}
    >
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
        <Image src={product.image_url} alt="" fill className="object-contain" sizes="32px" unoptimized />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Grej-tip</span>
        <span className="text-[13px] font-semibold text-primary">{product.product_name}</span>
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
