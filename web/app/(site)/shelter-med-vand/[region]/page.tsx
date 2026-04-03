import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrossFilterRegionPage } from "@/components/CrossFilterRegionPage";
import { getFilterRegionCount, getSheltersForFilterRegion, getKommuneBreakdownForFilterRegion } from "@/lib/fakta-db";
import { generateCrossPageFaq } from "@/lib/fakta-faq";
import { FILTER_CONFIGS, REGION_NAMES, REGION_SLUGS, getOtherRegionLinks, getOtherFilterLinks } from "@/lib/cross-page-config";
import { prepositionForRegionName } from "@/lib/area-db";
import { getDistinctRegions } from "@/lib/danmark-silo";
import { slugifySegment } from "@/lib/slug";

const FILTER = FILTER_CONFIGS["vand"];
const MIN_SHELTERS = FILTER.minSheltersForRegion;

export const revalidate = 86400;
export const dynamicParams = false;

interface PageProps { params: Promise<{ region: string }> }

export async function generateStaticParams() {
  const regions = await getDistinctRegions();
  const params: { region: string }[] = [];
  for (const region of regions) {
    const slug = slugifySegment(region);
    if (!REGION_SLUGS.includes(slug as typeof REGION_SLUGS[number])) continue;
    const count = await getFilterRegionCount(FILTER.filterKey, region);
    if (count >= MIN_SHELTERS) params.push({ region: slug });
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const regionName = REGION_NAMES[regionSlug];
  if (!regionName) return {};
  const prep = prepositionForRegionName(regionName);
  const title = `${FILTER.filterLabelLong} ${prep} ${regionName} | ShelterDK`;
  const description = `Find ${FILTER.filterLabelLong.toLowerCase()} ${prep} ${regionName}. Se kort, liste og faciliteter.`;
  const canonical = `${FILTER.parentHref}/${regionSlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonical}` },
    openGraph: { title, description, url: canonical },
    robots: { index: true, follow: true },
  };
}

export default async function Page({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regionName = REGION_NAMES[regionSlug];
  if (!regionName) notFound();
  const prep = prepositionForRegionName(regionName);

  const [shelters, kommuneBreakdown] = await Promise.all([
    getSheltersForFilterRegion(FILTER.filterKey, regionName),
    getKommuneBreakdownForFilterRegion(FILTER.filterKey, regionName),
  ]);

  if (shelters.length < MIN_SHELTERS) notFound();

  const freeCount = shelters.filter((s) => {
    const raw = s.geofa_raw as Record<string, unknown> | null;
    return raw && String(raw.betaling ?? "").toLowerCase() === "nej";
  }).length;

  const rated = shelters.filter((s) => s.google_rating != null);
  const topShelter = rated.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))[0];

  const regions = await getDistinctRegions();
  const validSlugs: string[] = [];
  for (const region of regions) {
    const slug = slugifySegment(region);
    if (!REGION_SLUGS.includes(slug as typeof REGION_SLUGS[number])) continue;
    const count = await getFilterRegionCount(FILTER.filterKey, region);
    if (count >= MIN_SHELTERS) validSlugs.push(slug);
  }

  const faqItems = generateCrossPageFaq(FILTER.filterKey, regionName, prep, {
    count: shelters.length,
    avgRating: rated.length > 0 ? Math.round((rated.reduce((s, r) => s + (r.google_rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    freeCount,
    topShelterName: topShelter?.title ?? null,
  });

  return (
    <CrossFilterRegionPage
      filterKey={FILTER.filterKey}
      filterLabel={FILTER.filterLabel}
      filterLabelLong={FILTER.filterLabelLong}
      regionName={regionName}
      preposition={prep}
      parentFilterHref={FILTER.parentHref}
      shelters={shelters}
      kommuneBreakdown={kommuneBreakdown}
      faqItems={faqItems}
      otherRegions={getOtherRegionLinks(FILTER, regionSlug, validSlugs)}
      otherFilters={getOtherFilterLinks(FILTER.filterKey, regionSlug)}
      relatedLinks={[
        { label: regionName, href: `/danmark/${regionSlug}` },
        ...FILTER.relatedBlogLinks,
      ]}
    />
  );
}
