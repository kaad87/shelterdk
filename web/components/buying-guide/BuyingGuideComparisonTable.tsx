import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";

function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString("da-DK")} kr.`;
}

/**
 * Sammenligningstabel: priser + scores synlige fra toppen (konvertering +
 * AI-citerbarhed). Mobil: horisontal scroll. "Se pris" linker direkte til
 * forhandleren (rel=sponsored).
 */
export function BuyingGuideComparisonTable({ entries }: { entries: GuideEntryWithProduct[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="my-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Sammenligning">
      <table className="w-full min-w-[560px] border-collapse text-sm">
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
                {e.score != null ? (
                  <span className="font-bold text-primary">
                    {formatScore(e.score)}
                    <span className="text-xs font-normal text-primary/40">/10</span>
                  </span>
                ) : (
                  <span className="text-primary/30">–</span>
                )}
              </td>
              <td className="py-3 pr-3 text-primary/70">{e.best_for ?? "–"}</td>
              <td className="py-3 pr-3 whitespace-nowrap font-medium text-primary">
                {formatPrice(e.product.price)}
              </td>
              <td className="py-3 whitespace-nowrap">
                <a
                  href={e.product.affiliate_url}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
                >
                  Se pris
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
