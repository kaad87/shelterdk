import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersPage, SOEG_PAGE_SIZE, type SoegFilters } from "@/lib/soeg-db";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";
import { getAreaBySlug, prepositionForArea, prepositionForRegionName } from "@/lib/area-db";
import { AreaFaq } from "@/components/AreaFaq";
import { getAreaFaqItems, faqToJsonLd, type FaqItem } from "@/lib/faq";

/** Ved kortvisning: send færre initialt for hurtigere load; resten hentes på client. */
const MAP_VIEW_PAGE_SIZE = 200;
import { SoegContent } from "@/components/SoegContent";

export const revalidate = 300; // ISR: revalider søgesiden hvert 5. min

const DEFAULT_METADATA: Metadata = {
  title: { absolute: "Søg shelters | ShelterDK" },
  description:
    "Se alle shelters i Danmark. Filtrer efter region, søg efter område og se listen eller kortvisning.",
  alternates: { canonical: "https://shelterdk.dk/soeg" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Søg shelters | ShelterDK",
    description: "Se alle shelters i Danmark. Filtrer efter region, søg efter område og se listen eller kortvisning.",
    url: "/soeg",
  },
};



export async function generateMetadata(props: {
  searchParams: Promise<{ area?: string; region?: string }>;
}): Promise<Metadata> {
  const { area: areaSlug, region } = await props.searchParams;

  // Area pages already have good SEO metadata.
  if (areaSlug?.trim()) {
    const area = await getAreaBySlug(areaSlug.trim());
    if (!area) return DEFAULT_METADATA;
    const prep = prepositionForArea(area);
    const title = `Shelters ${prep} ${area.name} – Se kort og liste | ShelterDK`;
    const description =
      area.description?.slice(0, 155) ||
      `Find shelters og naturovernatning ${prep} ${area.name}. Se kort, billeder og book muligheder.`;
    const canonicalPath = `/soeg?area=${encodeURIComponent(areaSlug.trim())}`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
      openGraph: {
        title: `Shelters ${prep} ${area.name} | ShelterDK`,
        description,
        url: canonicalPath,
      },
    };
  }

  // Region-filter: improve title for SEO while keeping page design/URL as-is.
  const regionTrim = region?.trim() || "";
  if (regionTrim && regionTrim.toLowerCase() !== "danmark") {
    const prep = prepositionForRegionName(regionTrim);
    const title = `Shelters ${prep} ${regionTrim} – Se kort og liste | ShelterDK`;
    const description = `Find shelters og overnatningspladser ${prep} ${regionTrim}. Se kort, billeder, faciliteter og book muligheder.`;
    return {
      title: { absolute: title },
      description,
      // Keep canonical as /soeg (existing behavior) to avoid indexing many variants unless explicitly desired.
      alternates: { canonical: "https://shelterdk.dk/soeg" },
      robots: { index: false, follow: true },
      openGraph: {
        title: `Shelters ${prep} ${regionTrim} | ShelterDK`,
        description,
        url: "/soeg",
      },
    };
  }

  return DEFAULT_METADATA;
}

type ViewMode = "list" | "map" | "split";

interface SoegPageProps {
  searchParams: Promise<{ region?: string; q?: string; view?: string; area?: string; billede?: string; anmeldelser?: string; bookbar?: string; vand?: string; toilet?: string; hund?: string; baalplads?: string; gratis?: string; handicap?: string; bord_baenk?: string; strand?: string; bruser?: string; min_pladser?: string }>;
}

function parseFilters(params: SoegPageProps["searchParams"] extends Promise<infer P> ? P : never) {
  const filters: SoegFilters = {};
  if (params.billede === "1") filters.billede = true;
  if (params.anmeldelser === "1") filters.anmeldelser = true;
  if (params.bookbar === "1") filters.bookbar = true;
  if (params.vand === "1") filters.vand = true;
  if (params.toilet === "1") filters.toilet = true;
  if (params.hund === "1") filters.hund = true;
  if (params.baalplads === "1") filters.baalplads = true;
  if (params.bord_baenk === "1") filters.bord_baenk = true;
  if (params.strand === "1") filters.strand = true;
  if (params.bruser === "1") filters.bruser = true;
  if (params.gratis === "1") filters.gratis = true;
  if (params.handicap === "1") filters.handicap = true;
  const minPladser = parseInt(params.min_pladser ?? "0", 10);
  if (minPladser > 0) filters.min_pladser = minPladser;
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
  const { shelters: rawShelters, hasMore: initialHasMore } = sheltersResult;
  const initialShelters = await enrichSheltersWithGooglePhotoRef(rawShelters);

  let areaFaqItems: FaqItem[] = [];
  let areaFaqJsonLd: string | undefined;
  const areaPreposition = areaInfo ? prepositionForArea(areaInfo) : "i";
  if (areaInfo) {
    areaFaqItems = getAreaFaqItems(areaInfo.name, areaPreposition);
    if (areaFaqItems.length > 0) {
      areaFaqJsonLd = JSON.stringify(faqToJsonLd(areaFaqItems));
    }
  }

  const breadcrumbItems = areaInfo
    ? [{ label: "Hjem", href: "/" }, { label: "Områder", href: "/omraade" }, { label: areaInfo.name }]
    : [{ label: "Hjem", href: "/" }, { label: "Søg shelters" }];

  return (
    <>
    <BreadcrumbSchema items={breadcrumbItems} />
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
            key={`${region ?? ""}-${q ?? ""}-${area ?? ""}-${Object.entries(filters).sort().map(([k, v]) => `${k}:${v}`).join(",")}`}
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
    Se alle shelters ${areaPreposition} ${areaInfo.name} hos Shelterdk.dk
  </a>
</p>`}
            </pre>
          </section>
        )}

        {areaInfo && areaFaqItems.length > 0 && (
          <AreaFaq
            areaName={areaInfo.name}
            preposition={prepositionForArea(areaInfo)}
            items={areaFaqItems}
            jsonLd={areaFaqJsonLd}
          />
        )}
      </div>
    </div>
    </>
  );
}
