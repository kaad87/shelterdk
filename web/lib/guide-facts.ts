import type { GuideEntryWithProduct } from "@/lib/buying-guides";

/**
 * Kort faktablok til købsguiderne.
 *
 * AI-assistenter citerer tal, ikke prosa — og /bedste er den eneste sektion de
 * beviseligt henter (alle 17 AI-henviste klik siden juni). Blokken samler det,
 * et svar kan løfte direkte: antal, prisspænd, hvornår priserne er tjekket, og
 * hvad scoren er. Det sidste punkt står med, fordi guiderne ellers læses som
 * en labtest — det er de ikke.
 */
export interface GuideFact {
  label: string;
  value: string;
}

function kr(n: number): string {
  return new Intl.NumberFormat("da-DK").format(Math.round(n));
}

export function guideFacts(
  entries: GuideEntryWithProduct[],
  priceCheckedLabel: string | null
): GuideFact[] {
  const buyable = entries.filter((e) => e.product.in_stock && !e.product.is_blocked);
  const prices = buyable
    .map((e) => e.product.price)
    .filter((n): n is number => typeof n === "number");

  const facts: GuideFact[] = [
    { label: "Produkter i guiden", value: `${buyable.length} der kan købes nu` },
  ];
  if (prices.length > 0) {
    facts.push({
      label: "Prisspænd",
      value: `${kr(Math.min(...prices))}–${kr(Math.max(...prices))} kr.`,
    });
  }
  if (priceCheckedLabel) {
    facts.push({ label: "Priser tjekket", value: `${priceCheckedLabel}, synkroniseret dagligt` });
  }
  facts.push({
    label: "Sådan scorer vi",
    value:
      "Redaktionel vurdering 0-10 ud fra værdi-for-pengene, egnethed, brand-pålidelighed og tilgængelighed — ikke en labtest",
  });
  return facts;
}
