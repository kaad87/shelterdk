import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
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
import { prepositionForRegionName } from "@/lib/area-db";
import { ShelterCard } from "@/components/ShelterCard";
import { getWater, getToilet, getPetsAllowed } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";

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
      images: [
        {
          url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop",
          width: 1200,
          height: 630,
          alt: `Shelters i ${municipalityName}, ${regionName}`,
        },
      ],
    },
    ...(shelters.length === 0 && { robots: { index: false, follow: true } }),
  };
}

function shelterHref(region: string, kommune: string | null, slug: string): string {
  const r = slugifySegment(region);
  const m = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${r}/${m}/${slug}`;
}



function MunicipalityProse({
  shelters,
  displayName,
  regionName,
  regionSlug,
}: {
  shelters: Shelter[];
  displayName: string;
  regionName: string;
  regionSlug: string;
}) {
  const total = shelters.length;
  const withToilet = shelters.filter((s) => {
    const t = getToilet(s);
    return t && t !== "none" && t !== "unknown";
  }).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const withPets = shelters.filter((s) => getPetsAllowed(s) === true).length;
  const bookable = shelters.filter((s) => !!s.booking_url).length;
  const rated = shelters.filter((s) => s.google_rating && s.google_rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((sum, s) => sum + (s.google_rating ?? 0), 0) / rated.length).toFixed(1)
    : null;
  const prep = prepositionForRegionName(regionName);

  // Build facility sentence parts
  const parts: string[] = [];
  if (withToilet > 0) parts.push(`${withToilet} har toilet`);
  if (withWater > 0) parts.push(`${withWater} har adgang til vand`);
  if (withPets > 0) parts.push(`${withPets} er hundevenlige`);
  if (bookable > 0) parts.push(`${bookable} kan bookes online`);
  const facilityText = parts.length > 0 ? `, hvoraf ${parts.join(", ")}` : "";

  return (
    <section className="prose prose-primary max-w-none text-primary/90">
      <h2 className="font-serif text-xl font-bold text-primary mb-4">
        Overnatning i {displayName}
      </h2>
      <p>
        I {displayName} {prep} {regionName} finder du {total} shelter{total !== 1 ? "s" : ""}{facilityText}.
        {avgRating && ` Den gennemsnitlige Google-rating er ${avgRating} stjerner baseret på ${rated.length} bedømte pladser.`}
        {" "}Uanset om du søger en primitiv overnatning under åben himmel eller en shelter med
        faciliteter som toilet og vand, giver {displayName} muligheder for naturoplevelser {prep} {regionName}.
      </p>
      <p>
        {bookable > 0 ? (
          <>Flere af pladserne i {displayName} kan bookes i forvejen via udinaturen.dk eller
          Naturstyrelsen, hvilket er praktisk i højsæsonen. </>
        ) : (
          <>De fleste shelters i {displayName} fungerer efter først-til-mølle-princippet,
          så det kan betale sig at komme tidligt, særligt i højsæsonen. </>
        )}
        Husk at følge lokal skiltning og regler for overnatning, og efterlad altid pladsen
        pænere end du fandt den.
      </p>
      <p>
        Se alle shelters{" "}
        <Link href={`/danmark/${regionSlug}`} className="text-accent hover:underline">
          {prep} {regionName}
        </Link>
        , eller udforsk shelters med specifikke faciliteter:{" "}
        <Link href="/shelter-med-toilet" className="text-accent hover:underline">
          toilet
        </Link>
        ,{" "}
        <Link href="/shelter-med-vand" className="text-accent hover:underline">
          vand
        </Link>
        ,{" "}
        <Link href="/shelter-med-hund" className="text-accent hover:underline">
          hund
        </Link>
        {" "}eller{" "}
        <Link href="/shelter-med-baalplads" className="text-accent hover:underline">
          bålplads
        </Link>
        . Læs også vores{" "}
        <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">
          pakkeliste til sheltertur
        </Link>
        .
      </p>
    </section>
  );
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
    <ShelterListSchema
      name={`Shelters i ${displayName}, ${regionName}`}
      shelters={shelters}
      hrefFn={(s) => shelterHref(regionName, shelters.find((x) => x.id === s.id)?.kommune ?? null, s.slug)}
    />
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

        <MunicipalityProse
          shelters={shelters}
          displayName={displayName}
          regionName={regionName}
          regionSlug={regionSlug}
        />
      </div>
    </div>
    </>
  );
}
