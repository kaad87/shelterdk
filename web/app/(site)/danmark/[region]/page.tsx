import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getDistinctRegions,
  slugifySegment,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";

interface PageProps {
  params: Promise<{ region: string }>;
}

export const dynamicParams = false;

/** ISR: cache og revalider hver 24. time. */
export const revalidate = 86400;

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
  const title = `Shelters i ${regionName} | ShelterDK`;
  const description = `Find shelters og overnatningspladser i ${regionName}. Se kort, liste og book muligheder.`;
  const canonicalPath = `/soeg?region=${encodeURIComponent(regionName)}`;
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

  // Brugeren foretrækker søgesiden med kort. Redirect så én kanonisk URL per region.
  redirect(`/soeg?region=${encodeURIComponent(regionName)}`);
}
