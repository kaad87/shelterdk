import { kortDato } from "@/lib/prisfald";

function fmt(n: number): string {
  return `${Math.round(n).toLocaleString("da-DK")} kr.`;
}

/**
 * Pris med evt. overstreget før-pris + rabat-badge — så tilbud også fremgår
 * i overblik og sammenligningstabel (ikke kun på produktkortet).
 *
 * `priceOriginal` og `discountPct` skal være VORES målte tal, ikke feedets.
 * getGuideBySlug bytter dem ud via lib/prisfald.ts, og `faldetSiden` er
 * dagen prisen faldt. Datoen er det der adskiller et prisfald fra en påstand:
 * "−33% · faldet 14. nov." kan efterprøves, "−33%" kan ikke.
 */
export function PriceTag({
  price,
  priceOriginal,
  discountPct,
  shippingCost,
  faldetSiden,
}: {
  price: number;
  priceOriginal?: number | null;
  discountPct?: number | null;
  /** 0 = fri fragt (vises som badge); null/undefined = ukendt (vises ikke). */
  shippingCost?: number | null;
  /** YYYY-MM-DD fra `product.prisfald.siden`. */
  faldetSiden?: string | null;
}) {
  const hasDeal = priceOriginal != null && priceOriginal > price;
  // discount_pct mangler ofte i feed'et — beregn den selv ud fra før-prisen.
  const pct = hasDeal ? (discountPct ?? Math.round((1 - price / priceOriginal!) * 100)) : 0;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="font-bold text-primary">{fmt(price)}</span>
      {hasDeal && (
        <span className="text-xs text-primary/40 line-through">{fmt(priceOriginal!)}</span>
      )}
      {hasDeal && pct > 0 && (
        <span className="rounded bg-accent/10 px-1 py-0.5 text-[10px] font-semibold text-accent">
          −{pct}%
        </span>
      )}
      {hasDeal && faldetSiden && (
        <span className="text-[11px] text-primary/60">faldet {kortDato(faldetSiden)}</span>
      )}
      {shippingCost === 0 && (
        <span className="rounded bg-green-50 px-1 py-0.5 text-[10px] font-semibold text-green-700">
          Fri fragt
        </span>
      )}
    </span>
  );
}
