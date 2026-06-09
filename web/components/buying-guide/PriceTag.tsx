function fmt(n: number): string {
  return `${Math.round(n).toLocaleString("da-DK")} kr.`;
}

/**
 * Pris med evt. overstreget før-pris + rabat-badge — så tilbud også fremgår
 * i overblik og sammenligningstabel (ikke kun på produktkortet).
 */
export function PriceTag({
  price,
  priceOriginal,
  discountPct,
}: {
  price: number;
  priceOriginal?: number | null;
  discountPct?: number | null;
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
    </span>
  );
}
