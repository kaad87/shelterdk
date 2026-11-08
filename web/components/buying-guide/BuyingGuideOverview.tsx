import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { rentNavn } from "@/lib/produktnavn";
import { formatScore } from "@/lib/buying-guides-score";
import { StarRating } from "@/components/buying-guide/StarRating";
import { AffiliateLink } from "@/components/buying-guide/AffiliateLink";
import { PriceTag } from "@/components/buying-guide/PriceTag";
import { ProduktBillede } from "@/components/ProduktBillede";

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
            {/* Fast hoejde til to linjer badge.
                55 af de 239 badges paa tvaers af guiderne er over 18 tegn og
                bryder over to linjer ved kortets 175 px. Uden reservationen
                starter billedet 16 px laengere nede i netop de kort, og saa
                staar raekken af kort ikke paa linje. Badget er valgfrit, saa
                raekken skal ogsaa kunne staa tom.
                leading-4 goer hoejden forudsigelig: 16 px linje + 2 x 2 px
                padding = 20 px for én linje, 36 px for to. */}
            <div className="mb-2 min-h-[2.25rem]">
              {e.award_label && (
                <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold leading-4 text-accent">
                  {e.award_label}
                </span>
              )}
            </div>
            <ProduktBillede
              src={e.product.image_url}
              alt={rentNavn(e.product)}
              width={160}
              height={96}
              className="mx-auto h-24 w-full object-contain"
            />
            {/* Tre linjer, ikke to: kortet er ~160 px bredt, så to linjer klippede
                126 af 157 produktnavne (80%) — typisk netop sæson, størrelse
                eller model, som er det der adskiller produkterne. Med tre
                linjer klippes 27%. Titlen bliver aldrig lang nok til at
                skubbe CTA'en ud af kortet, fordi grid'et er ens-højt.
                Målingen er fra før rentNavn(), som gør navnene kortere; tre
                linjer er derfor rigeligt nu, ikke for lidt. */}
            <h3 className="mt-2 line-clamp-3 text-sm font-semibold text-primary">
              {rentNavn(e.product)}
            </h3>
            {/* Score, pris og knap hoerer sammen og laegges i bunden.
                Titlen fylder 1-3 linjer, saa uden mt-auto stod stjerner,
                pris og CTA 20 eller 40 px forskudt fra kort til kort. Det
                er dem oejet sammenligner paa tvaers, saa det er dem der
                skal staa paa linje; at titlens underkant er ujaevn goer
                ikke noget. Kortene er allerede lige hoeje, fordi grid
                straekker dem, saa mt-auto er nok. */}
            <div className="mt-auto pt-2">
              {e.score != null && (
                <div className="flex items-center gap-1.5">
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
                  shippingCost={e.product.shipping_cost}
                />
              </div>
              <AffiliateLink product={e.product} position="guide_overview" className="mt-2 w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
