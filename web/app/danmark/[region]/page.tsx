import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ChevronRight } from "lucide-react";
import {
  getDistinctRegions,
  getRegionKommunePairs,
  getTopSheltersInRegion,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";

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
  if (!regionName) return { title: "Region ikke fundet" };
  return {
    title: `Shelters i ${regionName} | ShelterDK`,
    description: `Find shelters og overnatningspladser i ${regionName}. Se kommuner, top shelters og book muligheder.`,
  };
}

function shelterHref(region: string, kommune: string | null, slug: string): string {
  const r = slugifySegment(region);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${r}/${m}/${slug}`;
}

export default async function DanmarkRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regions = await getDistinctRegions();
  const regionName = segmentSlugToName(regionSlug, regions);
  if (!regionName) notFound();

  const [pairs, topShelters] = await Promise.all([
    getRegionKommunePairs(2),
    getTopSheltersInRegion(regionName, 12),
  ]);
  const municipalities = pairs
    .filter((p) => p.region === regionName)
    .map((p) => ({ name: p.kommune ?? "Ukendt kommune", slug: p.kommune ? slugifySegment(p.kommune) : NO_KOMMUNE_SLUG }));

  return (
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
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">{regionName}</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelters i {regionName}
          </h1>
          <p className="text-primary/80 text-lg">
            Udforsk kommuner og overnatningspladser i {regionName}.{" "}
            <Link href="/omraade" className="text-accent font-medium hover:underline">
              Shelter efter område
            </Link>
          </p>
        </header>

        <section className="mb-12">
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Kommuner i {regionName}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {municipalities.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/danmark/${regionSlug}/${m.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-primary/10 bg-white px-4 py-4 sm:py-3 text-primary hover:border-accent hover:bg-accent/5 active:bg-accent/10 transition-colors touch-manipulation"
                >
                  <MapPin size={18} className="text-accent shrink-0" />
                  <span>{m.name}</span>
                  <ChevronRight size={16} className="text-primary/40 ml-auto shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Populære shelters i {regionName}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {topShelters.map((shelter) => (
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
            Shelters og overnatning i {regionName}
          </h2>
          <p>
            {regionName} har rigeligt med shelterpladser til overnatning i naturen. Fra populære
            kyststrækninger til skjulte skovområder finder du både åbne shelterpladser og lukkede
            shelters. Mange kan bookes på forhånd via udinaturen.dk, Book en Shelter eller
            Naturstyrelsen.
          </p>
          <p>
            Udforsk kommunerne ovenfor for at finde shelters tæt på dit ønskede område. Her kan du
            se pladser med billeder, anmeldelser og praktisk info om booking, hund og faciliteter.
          </p>
        </section>
      </div>
    </div>
  );
}
