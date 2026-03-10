import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDistinctRegions, slugifySegment } from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { getSheltersPage } from "@/lib/soeg-db";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SoegContent } from "@/components/SoegContent";

interface PageProps {
  params: Promise<{ region: string }>;
}

export const dynamicParams = false;

/** ISR: cache og revalider hver 24. time. */
export const revalidate = 86400;

const MAP_VIEW_PAGE_SIZE = 1000;

function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  if (r === "fyn" || r === "sjælland" || r === "bornholm") return "på";
  return "i";
}

export async function generateStaticParams() {
  const regions = await getDistinctRegions();
  return regions.map((region) => ({
    region: slugifySegment(region),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const regions = await getDistinctRegions();
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) return { title: { absolute: "Region ikke fundet" } };
  const prep = prepositionForRegionName(regionName);
  const title = `Shelters ${prep} ${regionName} – Se kort og liste | ShelterDK`;
  const description = `Find alle shelters ${prep} ${regionName}. Udforsk overnatningspladser i naturen på interaktivt kort og liste – med billeder, faciliteter og booking.`;
  const canonicalPath = `/danmark/${regionSlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title,
      description,
      url: canonicalPath,
    },
  };
}

export default async function DanmarkRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regions = await getDistinctRegions();
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) notFound();

  const prep = prepositionForRegionName(regionName);

  const { shelters: initialShelters, hasMore: initialHasMore } = await getSheltersPage(
    regionName,
    null,
    1,
    MAP_VIEW_PAGE_SIZE
  );

  const breadcrumbItems = [
    { label: "Hjem", href: "/" },
    { label: "Søg shelters", href: "/soeg" },
    { label: regionName },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <nav className="mb-8 flex flex-wrap items-center gap-3">
            <Link href="/" className="text-primary/80 hover:text-accent text-sm font-medium">
              ← Til forsiden
            </Link>
            <span className="text-primary/40" aria-hidden>|</span>
            <Link href="/soeg" className="text-primary/80 hover:text-accent text-sm font-medium">
              Alle shelters
            </Link>
          </nav>

          <h1 className="font-serif text-3xl font-bold text-primary mb-2">
            Shelters {prep} {regionName}
          </h1>
          <p className="text-primary/80 mb-8">
            Udforsk overnatningspladser i naturen {prep} {regionName} på kort og liste.{" "}
            <Link href="/omraade" className="text-accent hover:underline">
              Shelter efter område →
            </Link>
          </p>

          <Suspense fallback={<div className="h-14 bg-primary/5 rounded-xl animate-pulse mb-8" />}>
            <SoegContent
              key={regionSlug}
              initialShelters={initialShelters}
              initialHasMore={initialHasMore}
              initialRegion={regionName}
              initialQuery={null}
              initialArea={null}
              initialFilters={{}}
              view="split"
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}
