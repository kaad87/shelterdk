import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSheltersPage, SOEG_PAGE_SIZE } from "@/lib/soeg-db";

/** Ved kortvisning: max pr. request (Supabase typisk 1000). Resten hentes på client. */
const MAP_VIEW_PAGE_SIZE = 1000;
import { SoegContent } from "@/components/SoegContent";

export const revalidate = 300; // ISR: revalider søgesiden hvert 5. min

export const metadata: Metadata = {
  title: "Søg shelters",
  description:
    "Se alle shelters i Danmark. Filtrer efter region, søg efter område og se listen eller kortvisning.",
};

type ViewMode = "list" | "map" | "split";

interface SoegPageProps {
  searchParams: Promise<{ region?: string; q?: string; view?: string; billede?: string; anmeldelser?: string; bookbar?: string }>;
}

function parseFilters(params: SoegPageProps["searchParams"] extends Promise<infer P> ? P : never) {
  const filters: { billede?: boolean; anmeldelser?: boolean; bookbar?: boolean } = {};
  if (params.billede === "1") filters.billede = true;
  if (params.anmeldelser === "1") filters.anmeldelser = true;
  if (params.bookbar === "1") filters.bookbar = true;
  return filters;
}

export default async function SoegPage({ searchParams }: SoegPageProps) {
  const params = await searchParams;
  const region = params.region ?? null;
  const q = params.q ?? null;
  const viewParam = (params.view ?? "split").toLowerCase();
  const view: ViewMode =
    viewParam === "map" ? "map" : viewParam === "list" ? "list" : "split";
  const filters = parseFilters(params);

  const initialPageSize =
    view === "map" || view === "split" ? MAP_VIEW_PAGE_SIZE : SOEG_PAGE_SIZE;
  const { shelters: initialShelters, hasMore: initialHasMore } =
    await getSheltersPage(region, q, 1, initialPageSize, Object.keys(filters).length ? filters : undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <nav className="mb-8">
          <Link
            href="/"
            className="text-primary/80 hover:text-accent text-sm font-medium"
          >
            ← Til forsiden
          </Link>
        </nav>

        <h1 className="font-serif text-3xl font-bold text-primary mb-2">
          Søg shelters
        </h1>
        <p className="text-primary/80 mb-8">
          Shelters i Danmark
          {(region || q) ? " (filtreret)" : ""}
        </p>

        <Suspense
          fallback={
            <div className="h-14 bg-primary/5 rounded-xl animate-pulse mb-8" />
          }
        >
          <SoegContent
            key={`${region ?? ""}-${q ?? ""}-${String(filters.billede)}-${String(filters.anmeldelser)}-${String(filters.bookbar)}`}
            initialShelters={initialShelters}
            initialHasMore={initialHasMore}
            initialRegion={region}
            initialQuery={q}
            initialFilters={filters}
            view={view}
          />
        </Suspense>
      </div>
    </div>
  );
}
