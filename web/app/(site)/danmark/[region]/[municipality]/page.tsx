import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ChevronRight } from "lucide-react";
import {
  getRegionKommunePairs,
  getMunicipalitiesInRegion,
  getSheltersInMunicipality,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";
import { segmentSlugToName } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";

interface PageProps {
  params: Promise<{ region: string; municipality: string }>;
}

export const dynamicParams = false;

/** ISR: cache og revalider hver 24. time. */
export const revalidate = 86400;

export async function generateStaticParams() {
  const pairs = await getRegionKommunePairs(2);
  return pairs.map(({ region, kommune }) => ({
    region: slugifySegment(region),
    municipality: kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug, municipality: municipalitySlug } = await params;
  const pairs = await getRegionKommunePairs(2);
  const regions = [...new Set(pairs.map((p) => p.region))];
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) return { title: { absolute: "Region ikke fundet" } };
  const municipalities = await getMunicipalitiesInRegion(regionName, 2);
  const municipalityName =
    municipalitySlug === NO_KOMMUNE_SLUG
      ? "Ukendt kommune"
      : segmentSlugToName(municipalitySlug, municipalities);
  if (!municipalityName) return { title: { absolute: "Kommune ikke fundet" } };
  const shelters = await getSheltersInMunicipality(regionName, municipalityName === "Ukendt kommune" ? null : (municipalityName ?? null));
  const title = `Shelters i ${municipalityName}, ${regionName} | ShelterDK`;
  const description = `Find shelters og overnatningspladser i ${municipalityName}, ${regionName}. Se pladser, booking og praktisk info.`;
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title,
      description,
      url: canonicalPath,
    },
    ...(shelters.length === 0 && { robots: { index: false, follow: true } }),
  };
}

function shelterHref(region: string, kommune: string | null, slug: string): string {
  const r = slugifySegment(region);
  const m = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${r}/${m}/${slug}`;
}

function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  if (r === "fyn" || r === "sjælland" || r === "bornholm") return "på";
  return "i";
}

export default async function DanmarkMunicipalityPage({ params }: PageProps) {
  const { region: regionSlug, municipality: municipalitySlug } = await params;
  const pairs = await getRegionKommunePairs(2);
  const regions = [...new Set(pairs.map((p) => p.region))];
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) notFound();

  const municipalities = await getMunicipalitiesInRegion(regionName, 2);
  const municipalityName =
    municipalitySlug === NO_KOMMUNE_SLUG
      ? null
      : segmentSlugToName(municipalitySlug, municipalities);
  if (municipalitySlug !== NO_KOMMUNE_SLUG && !municipalityName) notFound();

  const rawShelters = await getSheltersInMunicipality(regionName, municipalityName ?? null);
  const shelters = await enrichSheltersWithGooglePhotoRef(rawShelters);
  const displayName = municipalityName ?? "Ukendt kommune";

  return (
    <>
    <BreadcrumbSchema items={[
      { label: "Hjem", href: "/" },
      { label: regionName, href: `/danmark/${regionSlug}` },
      { label: displayName },
    ]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
            Hjem
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link href="/soeg" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
            Søg shelters
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link
            href={`/danmark/${regionSlug}`}
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            {regionName}
          </Link>
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">{displayName}</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelters i {displayName}
          </h1>
          <p className="text-primary/80 text-lg">
            {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} i {displayName}, {regionName}.{" "}
            <Link href="/omraade" className="text-accent font-medium hover:underline">
              Shelter efter område
            </Link>
          </p>
        </header>

        <section className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shelters.map((shelter) => (
              <ShelterCard
                key={shelter.id}
                shelter={shelter}
                href={shelterHref(regionName, shelter.kommune ?? null, shelter.slug)}
              />
            ))}
          </div>
        </section>

        <section className="prose prose-primary max-w-none text-primary/90">
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Overnatning i {displayName}
          </h2>
          <p>
            Shelters i {displayName} tilbyder overnatningsmuligheder midt i naturen i {regionName}.
            Mange shelterpladser i kommunen kan bookes i forvejen via udinaturen.dk eller
            Naturstyrelsen, hvilket er særligt praktisk i højsæsonen. Uanset om du vil sove under
            åben himmel eller i en lukket shelter, finder du flere muligheder her på listen.
          </p>
          <p>
            Husk at følge lokal skiltning og evt. regler for overnatning. De fleste shelters har
            bålplads og mulighed for at tage hund med – tjek den enkelte plads for detaljer og
            bookingmuligheder.
          </p>
          <p>
            Se alle shelters{" "}
            <Link href={`/danmark/${regionSlug}`} className="text-accent hover:underline">
              {prepositionForRegionName(regionName)} {regionName}
            </Link>
            , eller filtrer på{" "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">
              shelter med toilet
            </Link>
            {" "}og{" "}
            <Link href="/shelter-med-vand" className="text-accent hover:underline">
              shelter med vand
            </Link>
            {" "}i hele Danmark.
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
