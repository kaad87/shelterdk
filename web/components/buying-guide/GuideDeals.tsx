import { getTopDeals } from "@/lib/affiliate-deals";
import { GearCardView } from "@/components/GearCard";
import type { GuideEntryWithProduct } from "@/lib/buying-guides";

/**
 * "På tilbud lige nu"-modul til købsguide-sider: viser op til 3 aktuelle tilbud
 * (≥25 % rabat, på lager) fra samme kategori som guidens produkter — ekskl.
 * produkter der allerede er med i guiden. Kategorien udledes af guidens egne
 * entries (hyppigste category_mapped), så guide-kategori vs. produkt-taksonomi
 * (fx campingstol → campingmobler) matcher automatisk. Renderer intet når der
 * ikke er relevante tilbud — ingen tom sektion.
 */
export async function GuideDeals({ entries }: { entries: GuideEntryWithProduct[] }) {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const c = e.product.category_mapped;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!category) return null;

  const inGuide = new Set(entries.map((e) => e.product.id));
  let deals;
  try {
    deals = (await getTopDeals({ category })).filter((p) => !inGuide.has(p.id)).slice(0, 3);
  } catch {
    return null;
  }
  if (!deals || deals.length === 0) return null;

  return (
    <section aria-labelledby="guide-deals-heading" className="mt-10 border-t border-primary/10 pt-6">
      <h2 id="guide-deals-heading" className="mb-1 font-serif text-xl font-bold text-primary">
        På tilbud lige nu
      </h2>
      <p className="mb-4 text-xs text-primary/50">
        Aktuelle nedsættelser i samme kategori — priser og lager opdateres dagligt.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {deals.map((p) => (
          <GearCardView key={p.id} product={p} variant="product" />
        ))}
      </div>
    </section>
  );
}
