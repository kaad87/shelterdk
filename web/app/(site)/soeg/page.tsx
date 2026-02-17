import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSheltersPage, SOEG_PAGE_SIZE } from "@/lib/soeg-db";
import { getAreaBySlug, prepositionForArea } from "@/lib/area-db";

/** Ved kortvisning: max pr. request (Supabase typisk 1000). Resten hentes på client. */
const MAP_VIEW_PAGE_SIZE = 1000;
import { SoegContent } from "@/components/SoegContent";

export const revalidate = 300; // ISR: revalider søgesiden hvert 5. min

const DEFAULT_METADATA: Metadata = {
  title: { absolute: "Søg shelters | ShelterDK" },
  description:
    "Se alle shelters i Danmark. Filtrer efter region, søg efter område og se listen eller kortvisning.",
  openGraph: {
    title: "Søg shelters | ShelterDK",
    description: "Se alle shelters i Danmark. Filtrer efter region, søg efter område og se listen eller kortvisning.",
    url: "/soeg",
  },
};

export async function generateMetadata(props: { searchParams: Promise<{ area?: string }> }): Promise<Metadata> {
  const { area: areaSlug } = await props.searchParams;
  if (!areaSlug?.trim()) return DEFAULT_METADATA;
  const area = await getAreaBySlug(areaSlug.trim());
  if (!area) return DEFAULT_METADATA;
  const prep = prepositionForArea(area);
  const title = `Shelters ${prep} ${area.name} – Se kort og liste | ShelterDK`;
  const description =
    area.description?.slice(0, 155) ||
    `Find shelters og naturovernatning ${prep} ${area.name}. Se kort, billeder og book muligheder.`;
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title: `Shelters ${prep} ${area.name} | ShelterDK`,
      description,
      url: `/soeg?area=${encodeURIComponent(areaSlug.trim())}`,
    },
  };
}

type ViewMode = "list" | "map" | "split";

interface SoegPageProps {
  searchParams: Promise<{ region?: string; q?: string; view?: string; area?: string; billede?: string; anmeldelser?: string; bookbar?: string }>;
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
  const area = params.area ?? null;
  const viewParam = (params.view ?? "split").toLowerCase();
  const view: ViewMode =
    viewParam === "map" ? "map" : viewParam === "list" ? "list" : "split";
  const filters = parseFilters(params);

  const initialPageSize =
    view === "map" || view === "split" ? MAP_VIEW_PAGE_SIZE : SOEG_PAGE_SIZE;
  const [areaInfo, sheltersResult] = await Promise.all([
    area?.trim() ? getAreaBySlug(area.trim()) : Promise.resolve(null),
    getSheltersPage(region, q, 1, initialPageSize, Object.keys(filters).length ? filters : undefined, undefined, area),
  ]);
  const { shelters: initialShelters, hasMore: initialHasMore } = sheltersResult;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <nav className="mb-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-primary/80 hover:text-accent text-sm font-medium"
          >
            ← Til forsiden
          </Link>
          <span className="text-primary/40" aria-hidden>|</span>
          <Link
            href="/omraade"
            className="text-primary/80 hover:text-accent text-sm font-medium"
          >
            Udforsk efter område
          </Link>
        </nav>

        <h1 className="font-serif text-3xl font-bold text-primary mb-2">
          {areaInfo
            ? `Shelters ${prepositionForArea(areaInfo)} ${areaInfo.name}`
            : "Søg shelters"}
        </h1>
        {areaInfo ? (
          <section className="mb-8" aria-label="Om området">
            {areaInfo.description ? (
              <p className="text-primary/90 text-lg leading-relaxed max-w-3xl">
                {areaInfo.description}
              </p>
            ) : (
              <p className="text-primary/80 max-w-3xl">
                Udforsk shelters og naturovernatning i {areaInfo.name}. Her finder du overnatningspladser med kort,
                billeder og book muligheder – både åbne shelterpladser og lukkede shelters.
              </p>
            )}
            <p className="mt-3 text-primary/70 text-sm">
              <Link href="/omraade" className="text-accent hover:underline">
                Alle områder
              </Link>
            </p>
          </section>
        ) : (
          <p className="text-primary/80 mb-8">
            Shelters i Danmark
            {(region || q || area) ? " (filtreret)" : ""}
            {" – "}
            <Link href="/omraade" className="text-accent hover:underline">
              shelter efter område
            </Link>
          </p>
        )}

        <Suspense
          fallback={
            <div className="h-14 bg-primary/5 rounded-xl animate-pulse mb-8" />
          }
        >
          <SoegContent
            key={`${region ?? ""}-${q ?? ""}-${area ?? ""}-${String(filters.billede)}-${String(filters.anmeldelser)}-${String(filters.bookbar)}`}
            initialShelters={initialShelters}
            initialHasMore={initialHasMore}
            initialRegion={region}
            initialQuery={q}
            initialArea={area}
            initialFilters={filters}
            view={view}
          />
        </Suspense>

        {areaInfo && area && (
          <section aria-labelledby="embed-heading" className="mt-12 pt-8 border-t border-primary/10">
            <h2 id="embed-heading" className="font-serif text-xl font-semibold text-primary mb-2">
              Indlejr dette kort
            </h2>
            <p className="text-primary/80 mb-3 text-sm">
              Turistbureauer og partnere kan indlejre kortet med nedenstående kode. Linket under
              iframen giver SEO-værdi og peger på denne side.
            </p>
            <pre className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono text-primary/90">
{`<iframe
  src="https://shelterdk.dk/embed/${area}"
  title="Shelter-kort ${areaInfo.name}"
  width="100%"
  height="500"
  loading="lazy"
  style="border: none;"
></iframe>
<p style="text-align: right; font-size: 12px; margin-top: 5px;">
  <a href="https://shelterdk.dk/soeg?area=${encodeURIComponent(area)}" target="_blank" rel="noopener">
    Se alle shelters ${prepositionForArea(areaInfo)} ${areaInfo.name} hos Shelterdk.dk
  </a>
</p>`}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
