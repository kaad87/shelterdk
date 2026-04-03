import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDistinctRegions, slugifySegment, NO_KOMMUNE_SLUG } from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { getSheltersPage } from "@/lib/soeg-db";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";
import { prepositionForRegionName } from "@/lib/area-db";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { SoegContent } from "@/components/SoegContent";
import { getRegionContent } from "@/data/region-content";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFacilityCountsForRegion, getTopRatedShelters } from "@/lib/fakta-db";
import { generateRegionPageFaq } from "@/lib/fakta-faq";
import { faqToJsonLd } from "@/lib/faq";
import { FILTER_CONFIGS, REGION_SLUGS, REGION_NAMES } from "@/lib/cross-page-config";

interface PageProps {
  params: Promise<{ region: string }>;
}

export const dynamicParams = false;

/** ISR: cache og revalider hver 24. time. */
export const revalidate = 86400;

const MAP_VIEW_PAGE_SIZE = 1000;


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
      images: [
        {
          url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop",
          width: 1200,
          height: 630,
          alt: `Shelters ${prep} ${regionName}`,
        },
      ],
    },
  };
}

export default async function DanmarkRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regions = await getDistinctRegions();
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) notFound();

  const prep = prepositionForRegionName(regionName);

  const [{ shelters: rawShelters, hasMore: initialHasMore }, facilityCounts, topRated] =
    await Promise.all([
      getSheltersPage(regionName, null, 1, MAP_VIEW_PAGE_SIZE),
      getFacilityCountsForRegion(regionName),
      getTopRatedShelters(1, 3),
    ]);
  const initialShelters = await enrichSheltersWithGooglePhotoRef(rawShelters);

  const totalCount = initialShelters.length;
  const freeCount = facilityCounts.gratis;
  const topInRegion = topRated.find(
    (s) => (s.region ?? "").trim() === regionName
  );

  const faqItems = generateRegionPageFaq(regionName, prep, {
    totalCount,
    freeCount,
    facilityCounts,
    avgRating: null,
    topShelterName: topInRegion?.title?.trim() ?? null,
  });

  const crossPageLinks = Object.values(FILTER_CONFIGS)
    .slice(0, 5)
    .map((c) => ({
      label: `${c.filterLabelLong} ${prep} ${regionName}`,
      href: `${c.parentHref}/${regionSlug}`,
    }));

  const breadcrumbItems = [
    { label: "Hjem", href: "/" },
    { label: "Søg shelters", href: "/soeg" },
    { label: regionName },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <ShelterListSchema
        name={`Shelters ${prep} ${regionName}`}
        shelters={initialShelters}
        hrefFn={(s) => {
          const sh = initialShelters.find((x) => x.id === s.id);
          const m = sh?.kommune ? slugifySegment(sh.kommune) : NO_KOMMUNE_SLUG;
          return `/danmark/${regionSlug}/${m}/${s.slug}`;
        }}
      />
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

          <DataSummaryBlock
            headline={`${regionName} har ${totalCount} shelters. ${freeCount} er gratis, ${facilityCounts.toilet} har toilet.`}
            crossPageLinks={crossPageLinks}
          />

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

          {(() => {
            const content = getRegionContent(regionName);
            if (!content) return null;
            return (
              <section className="mt-12 pt-8 border-t border-primary/10 prose prose-primary max-w-none text-primary/90">
                <p className="text-lg leading-relaxed">{content.intro}</p>

                <div className="flex flex-wrap gap-3 my-6 not-prose">
                  {content.highlights.map((h) => (
                    <span key={h} className="bg-accent/10 text-accent text-sm font-medium px-3 py-1 rounded-full">
                      {h}
                    </span>
                  ))}
                </div>

                {content.sections.map((s) => (
                  <div key={s.heading}>
                    <h2 className="font-serif text-xl font-bold text-primary mt-8 mb-3">{s.heading}</h2>
                    <p>{s.text}</p>
                  </div>
                ))}

                <p className="mt-8">
                  Udforsk shelters med specifikke faciliteter:{" "}
                  <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>,{" "}
                  <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>,{" "}
                  <Link href="/shelter-med-hund" className="text-accent hover:underline">hundevenlige shelters</Link>{" "}
                  eller{" "}
                  <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>.
                </p>
                <p className="mt-4">
                  Læs også vores{" "}
                  <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste til sheltertur</Link>,{" "}
                  <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">regler for shelter og teltning</Link>{" "}
                  og{" "}
                  <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-accent hover:underline">begynderguiden</Link>.{" "}
                  Se også{" "}
                  <Link href="/blog/de-bedste-regioner" className="text-accent hover:underline">de bedste regioner for shelterture</Link>,{" "}
                  <Link href="/blog/gratis-shelters-i-danmark" className="text-accent hover:underline">gratis shelters i Danmark</Link>{" "}
                  og{" "}
                  <Link href="/fakta/shelters-i-danmark" className="text-accent hover:underline">tal og fakta om shelters</Link>.
                </p>
              </section>
            );
          })()}

          {/* FAQ with JSON-LD */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om shelters {prep} {regionName}
            </h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
