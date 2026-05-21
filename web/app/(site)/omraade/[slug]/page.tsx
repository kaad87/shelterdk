import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { AreaFaq } from "@/components/AreaFaq";
import { ShelterCard } from "@/components/ShelterCard";
import {
  getAllAreas,
  getAreaBySlug,
  getSheltersByAreaSlug,
  prepositionForArea,
} from "@/lib/area-db";
import { faqToJsonLd, getAreaFaqItems } from "@/lib/faq";
import { slugifySegment } from "@/lib/slug";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;

function getAreaDisplayParts(name: string) {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) {
    return { primaryName: trimmed, secondaryName: null as string | null };
  }

  return {
    primaryName: match[1].trim(),
    secondaryName: match[2].trim(),
  };
}

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const regionName = (region || "").trim();
  if (!regionName || regionName === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(regionName);
  const municipalitySlug = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${municipalitySlug}/${slug}`;
}

export async function generateStaticParams() {
  const areas = await getAllAreas();
  return areas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) {
    return { title: { absolute: "Område ikke fundet | ShelterDK" } };
  }

  const prep = prepositionForArea(area);
  const { primaryName, secondaryName } = getAreaDisplayParts(area.name);
  const canonicalPath = `/omraade/${slug}`;
  const description =
    area.description?.trim() ||
    `Find shelters ${prep} ${primaryName}. Se billeder, overnatningsmuligheder og links videre til kort, booking og nærliggende shelters.${secondaryName ? ` Siden dækker også ${secondaryName}.` : ""}`;

  return {
    title: {
      absolute: `Shelters ${prep} ${primaryName} – kort, billeder og overnatning | ShelterDK`,
    },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title: `Shelters ${prep} ${primaryName} | ShelterDK`,
      description,
      url: canonicalPath,
    },
  };
}

export default async function OmraadeSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) notFound();

  const shelters = await getSheltersByAreaSlug(slug);
  const prep = prepositionForArea(area);
  const { primaryName, secondaryName } = getAreaDisplayParts(area.name);
  const faqItems = getAreaFaqItems(primaryName, prep);
  const faqJsonLd = JSON.stringify(faqToJsonLd(faqItems));
  const featuredShelters = shelters.slice(0, 12);
  const regionSlug = slugifySegment(area.region);
  const remainingShelters = shelters.slice(12);
  const placeCounts = new Map<string, number>();
  const municipalityCounts = new Map<string, number>();
  for (const shelter of shelters) {
    const place = shelter.place?.trim();
    if (place) {
      placeCounts.set(place, (placeCounts.get(place) ?? 0) + 1);
    }
    const kommune = shelter.kommune?.trim();
    if (kommune) {
      municipalityCounts.set(kommune, (municipalityCounts.get(kommune) ?? 0) + 1);
    }
  }
  const topPlaces = [...placeCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "da");
    })
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, slug: slugifySegment(name) }));
  const topMunicipalities = [...municipalityCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "da");
    })
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, slug: slugifySegment(name) }));

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Områder", href: "/omraade" },
          { label: primaryName },
        ]}
      />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-8 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li>
                <Link href="/" className="hover:text-accent transition-colors">
                  Forside
                </Link>
              </li>
              <li aria-hidden className="text-primary/50">
                /
              </li>
              <li>
                <Link href="/omraade" className="hover:text-accent transition-colors">
                  Områder
                </Link>
              </li>
              <li aria-hidden className="text-primary/50">
                /
              </li>
              <li className="text-primary font-medium">{primaryName}</li>
            </ol>
          </nav>

          <header className="mb-10">
            <p className="text-accent font-semibold text-sm uppercase tracking-[0.18em] mb-3">
              Områdeguide
            </p>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-primary mb-4">
              Shelters {prep} {primaryName}
            </h1>
            <p className="text-primary/85 text-lg max-w-3xl leading-relaxed">
              {area.description?.trim() ||
                `${primaryName} rummer shelters og primitive overnatningspladser i ${area.region}.${secondaryName ? ` Områdesiden dækker også ${secondaryName}.` : ""} Her får du en landingsside med direkte links til de mest relevante pladser og videre adgang til den interaktive søgning.`}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-primary/5 px-4 py-2 text-primary/80">
                {shelters.length} shelters i området
              </span>
              <Link
                href="#alle-shelters"
                className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Se alle shelters
              </Link>
              <Link
                href={`/danmark/${regionSlug}`}
                className="rounded-full border border-primary/15 px-4 py-2 font-medium text-primary hover:border-accent/40 hover:text-accent transition-colors"
              >
                Se hele {area.region}
              </Link>
            </div>
          </header>

          <section className="mb-12">
            <div className="max-w-4xl rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">
                Sådan bruger du siden
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Brug denne områdeside som et hurtigt overblik over de mest relevante shelters {prep} {primaryName}.{secondaryName ? ` Siden samler også pladser fra ${secondaryName}.` : ""} Du kan starte med de udvalgte pladser herunder og hoppe direkte til den fulde liste længere nede på siden, hvis du vil have hele områdets katalog samlet ét sted.
              </p>
            </div>
          </section>

          {(topPlaces.length > 0 || topMunicipalities.length > 0) && (
            <section className="mb-12 grid gap-6 lg:grid-cols-2">
              {topPlaces.length > 0 && (
                <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
                  <h2 className="font-serif text-xl font-bold text-primary mb-3">
                    Populære byer i {primaryName}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {topPlaces.map((place) => (
                      <Link
                        key={place.slug}
                        href={`/by/${place.slug}`}
                        className="rounded-full border border-primary/10 bg-primary/[0.02] px-4 py-2 text-sm font-medium text-primary hover:border-accent/30 hover:text-accent transition-colors"
                      >
                        Shelter {place.name}
                        <span className="ml-2 text-primary/40">{place.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {topMunicipalities.length > 0 && (
                <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
                  <h2 className="font-serif text-xl font-bold text-primary mb-3">
                    Kommuner i området
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {topMunicipalities.map((municipality) => (
                      <Link
                        key={municipality.slug}
                        href={`/danmark/${regionSlug}/${municipality.slug}`}
                        className="rounded-full border border-primary/10 bg-primary/[0.02] px-4 py-2 text-sm font-medium text-primary hover:border-accent/30 hover:text-accent transition-colors"
                      >
                        {municipality.name}
                        <span className="ml-2 text-primary/40">{municipality.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="mb-12">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">
                  Udvalgte shelters {prep} {primaryName}
                </h2>
                <p className="text-primary/70 mt-1">
                  Direkte links til pladser med billeder, faciliteter og detaljer.
                </p>
              </div>
              {shelters.length > featuredShelters.length && (
                <Link
                  href="#alle-shelters"
                  className="hidden sm:inline text-accent font-medium hover:underline"
                >
                  Se alle {shelters.length}
                </Link>
              )}
            </div>

            {featuredShelters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {featuredShelters.map((shelter) => (
                  <ShelterCard
                    key={shelter.id}
                    shelter={shelter}
                    href={shelterHref(
                      shelter.region ?? null,
                      shelter.kommune ?? null,
                      shelter.slug
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/10 bg-white p-6 text-primary/70">
                Vi har endnu ikke nok shelters til at vise en områdeliste her. Udforsk i stedet regionen eller gå tilbage til områdeoversigten.
              </div>
            )}
          </section>

          <section id="alle-shelters" className="mb-12 scroll-mt-24">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">
                  Alle shelters {prep} {primaryName}
                </h2>
                <p className="text-primary/70 mt-1">
                  Hele områdets shelterkatalog samlet på én side.
                </p>
              </div>
              <span className="hidden sm:inline text-sm text-primary/60">
                {shelters.length} steder
              </span>
            </div>

            {shelters.length > 0 ? (
              <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {featuredShelters.concat(remainingShelters).map((shelter) => (
                    <Link
                      key={shelter.id}
                      href={shelterHref(
                        shelter.region ?? null,
                        shelter.kommune ?? null,
                        shelter.slug
                      )}
                      className="group flex items-start justify-between gap-4 rounded-xl border border-transparent px-3 py-3 hover:border-primary/10 hover:bg-primary/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-primary group-hover:text-accent transition-colors">
                          {shelter.title}
                        </p>
                        {(shelter.place || shelter.kommune) && (
                          <p className="text-sm text-primary/60 mt-1">
                            {shelter.place ? (
                              <Link
                                href={`/by/${slugifySegment(shelter.place)}`}
                                className="hover:text-accent transition-colors"
                              >
                                {shelter.place}
                              </Link>
                            ) : shelter.kommune ? (
                              <Link
                                href={`/danmark/${regionSlug}/${slugifySegment(shelter.kommune)}`}
                                className="hover:text-accent transition-colors"
                              >
                                {shelter.kommune}
                              </Link>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm text-accent font-medium">
                        Se side
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <AreaFaq
            areaName={primaryName}
            preposition={prep}
            items={faqItems}
            jsonLd={faqJsonLd}
          />

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-4">Læs mere</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="#alle-shelters" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
                Hele listen for {primaryName}
              </Link>
              <Link href={`/danmark/${regionSlug}`} className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
                Shelters i {area.region}
              </Link>
              <Link href="/omraade" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
                Andre områder
              </Link>
              <Link href="/guides/saadan-finder-du-det-perfekte-shelter" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
                Guide: sådan vælger du shelter
              </Link>
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
                Pakkeliste til turen
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
