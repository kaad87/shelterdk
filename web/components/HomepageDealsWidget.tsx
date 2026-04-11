import Link from "next/link";
import { getTopDeals } from "@/lib/affiliate-deals";
import { GearCard } from "./GearCard";

export async function HomepageDealsWidget() {
  const deals = await getTopDeals({});
  if (deals.length === 0) return null;

  // Hourly rotation across the top 20 so the same 4 cards aren't pinned
  // for 24h while ISR holds the page. Deterministic per hour → cache-safe.
  const bucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const top = deals.slice(0, 20);
  const offset = top.length > 0 ? bucket % top.length : 0;
  const rotated = [...top.slice(offset), ...top.slice(0, offset)];
  const picks = rotated.slice(0, 4);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary">
          Ugens outdoor-tilbud
        </h2>
        <Link
          href="/tilbud"
          className="text-sm font-medium text-accent hover:underline"
        >
          Se alle →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((p) => (
          <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
        ))}
      </div>
      <div className="mt-6 text-center text-xs text-primary/40">
        <Link href="/annoncer-og-partnere" className="hover:underline">
          Annoncer · Sponsorerede links
        </Link>
      </div>
    </section>
  );
}
