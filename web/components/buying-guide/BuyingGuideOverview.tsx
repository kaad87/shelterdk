import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";

function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString("da-DK")} kr.`;
}

/**
 * "Hurtigt overblik" — de højest-rangerede produkter som fremhævede kort til
 * hurtig scanning øverst på siden (badge + score + pris + CTA).
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
              className="mx-auto h-24 w-full object-contain"
            />
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-primary">
              {e.product.product_name}
            </h3>
            <div className="mt-1 flex items-center justify-between text-sm">
              {e.score != null && (
                <span className="font-bold text-primary">
                  {formatScore(e.score)}
                  <span className="text-xs font-normal text-primary/40">/10</span>
                </span>
              )}
              <span className="font-medium text-primary/80">{formatPrice(e.product.price)}</span>
            </div>
            <a
              href={e.product.affiliate_url}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="mt-2 block rounded-lg bg-accent px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-accent/90"
            >
              Se pris
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
