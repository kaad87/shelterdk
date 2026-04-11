import type { Metadata } from "next";
import Link from "next/link";
import { getTopDeals } from "@/lib/affiliate-deals";
import { GearCard } from "@/components/GearCard";

export const revalidate = 21600; // 6 hours

export const metadata: Metadata = {
  title: "Ugens bedste outdoor-tilbud",
  description:
    "De største prisfald på telte, soveposer, pandelamper og outdoor-grej — kurateret dagligt fra vores partnere.",
  alternates: { canonical: "/tilbud" },
};

interface PageProps {
  searchParams: Promise<{
    retailer?: string;
    category?: string;
    minDiscount?: string;
  }>;
}

export default async function TilbudPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const deals = await getTopDeals({
    retailer: params.retailer,
    category: params.category,
    minDiscount: params.minDiscount
      ? parseInt(params.minDiscount, 10)
      : undefined,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Tilbud</span>
      </nav>
      <header className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
          Ugens bedste outdoor-tilbud
        </h1>
        <p className="mt-3 max-w-2xl text-primary/70">
          Vi har samlet de største prisfald på shelter- og outdoor-grej fra
          vores partnere. Opdateret dagligt.
        </p>
        <p className="mt-2 text-xs text-primary/50">
          Alle produkter her er affiliate-links.{" "}
          <Link href="/annoncer-og-partnere" className="underline">
            Læs om hvordan det virker →
          </Link>
        </p>
      </header>

      {(params.retailer || params.category) && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-primary/60">Filter aktivt:</span>
          {params.retailer && (
            <span className="rounded-full bg-primary/5 px-3 py-1">
              Forhandler: {params.retailer}
            </span>
          )}
          {params.category && (
            <span className="rounded-full bg-primary/5 px-3 py-1">
              Kategori: {params.category}
            </span>
          )}
          <Link href="/tilbud" className="text-accent underline">
            Ryd filtre
          </Link>
        </div>
      )}

      {deals.length === 0 ? (
        <div className="rounded-xl bg-primary/5 py-16 text-center">
          <h2 className="font-serif text-xl text-primary">
            Ingen tilbud lige nu
          </h2>
          <p className="mt-2 text-primary/60">
            Kig tilbage snart — vi opdaterer dagligt.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((p) => (
            <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
          ))}
        </div>
      )}
    </div>
  );
}
