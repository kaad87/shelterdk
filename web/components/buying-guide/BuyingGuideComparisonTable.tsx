import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";
import { StarRating } from "@/components/buying-guide/StarRating";
import { AffiliateLink } from "@/components/buying-guide/AffiliateLink";
import { PriceTag } from "@/components/buying-guide/PriceTag";

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-primary/30">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StarRating score={score} size={13} />
      <span className="font-bold text-primary">
        {formatScore(score)}
        <span className="text-xs font-normal text-primary/40">/10</span>
      </span>
    </span>
  );
}

/**
 * Sammenligning: priser + scores/stjerner synlige fra toppen (konvertering +
 * AI-citerbarhed). Desktop: tabel. Mobil: stacked kort (ingen horisontal scroll).
 * CTA er tracket (AffiliateLink) og lager-bevidst.
 */
export function BuyingGuideComparisonTable({ entries }: { entries: GuideEntryWithProduct[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="my-8" aria-label="Sammenligning">
      {/* Desktop: tabel */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-primary/15 text-left text-primary/60">
              <th className="py-2.5 pr-3 font-medium">Produkt</th>
              <th className="py-2.5 pr-3 font-medium">Score</th>
              <th className="py-2.5 pr-3 font-medium">Bedst til</th>
              <th className="py-2.5 pr-3 font-medium">Pris</th>
              <th className="py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {entries.map((e) => (
              <tr key={e.id} className="align-middle">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.product.image_url}
                      alt={e.product.product_name}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-md object-contain"
                    />
                    <span className="font-medium text-primary">{e.product.product_name}</span>
                  </div>
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  <ScoreCell score={e.score} />
                </td>
                <td className="py-3 pr-3 text-primary/70">{e.best_for ?? "–"}</td>
                <td className="py-3 pr-3 whitespace-nowrap text-primary">
                  <PriceTag
                    price={e.product.price}
                    priceOriginal={e.product.price_original}
                    discountPct={e.product.discount_pct}
                  />
                </td>
                <td className="py-3 whitespace-nowrap">
                  <AffiliateLink product={e.product} position="guide_table" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil: stacked kort */}
      <ul className="space-y-3 sm:hidden">
        {entries.map((e) => (
          <li key={e.id} className="rounded-xl border border-primary/10 bg-white p-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.product.image_url}
                alt={e.product.product_name}
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-md object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary line-clamp-2">{e.product.product_name}</p>
                {e.best_for && <p className="text-xs text-primary/60">{e.best_for}</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <ScoreCell score={e.score} />
              <PriceTag
                price={e.product.price}
                priceOriginal={e.product.price_original}
                discountPct={e.product.discount_pct}
              />
            </div>
            <AffiliateLink product={e.product} position="guide_table" className="mt-2 w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}
