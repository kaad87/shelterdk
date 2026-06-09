import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";
import { StarRating } from "@/components/buying-guide/StarRating";
import { AffiliateLink } from "@/components/buying-guide/AffiliateLink";
import { PriceTag } from "@/components/buying-guide/PriceTag";

/**
 * "Hurtigt overblik" — de højest-rangerede produkter som fremhævede kort til
 * hurtig scanning øverst på siden (badge + score + stjerner + pris + tracket CTA).
 */
export function BuyingGuideOverview({
  entries,
  limit = 4,
}: {
  entries: GuideEntryWithProduct[];
  limit?: number;
}) {
  const top = entries.slice(0, limit);
  if (top.length < 2) return null;

  return (
    <section className="my-8" aria-label="Hurtigt overblik">
      <h2 className="mb-4 font-serif text-xl font-bold text-primary">Hurtigt overblik</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {top.map((e) => (
          <div
            key={e.id}
            className="flex flex-col rounded-xl border border-primary/10 bg-white p-3 shadow-sm"
          >
            {e.award_label && (
              <span className="mb-2 self-start rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                {e.award_label}
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.product.image_url}
              alt={e.product.product_name}
              width={160}
              height={96}
              className="mx-auto h-24 w-full object-contain"
            />
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-primary">
              {e.product.product_name}
            </h3>
            {e.score != null && (
              <div className="mt-1 flex items-center gap-1.5">
                <StarRating score={e.score} size={13} />
                <span className="text-xs font-bold text-primary">
                  {formatScore(e.score)}
                  <span className="font-normal text-primary/40">/10</span>
                </span>
              </div>
            )}
            <div className="mt-1 text-sm">
              <PriceTag
                price={e.product.price}
                priceOriginal={e.product.price_original}
                discountPct={e.product.discount_pct}
              />
            </div>
            <AffiliateLink product={e.product} position="guide_overview" className="mt-2 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
