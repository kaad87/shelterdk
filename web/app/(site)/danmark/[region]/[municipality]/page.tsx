import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { buildQuickAnswer } from "@/lib/quick-answer";
import { ChevronRight } from "lucide-react";
import {
  getByLandingData,
  getRegionKommunePairs,
  getMunicipalitiesInRegion,
  getSheltersInMunicipality,
  slugifySegment,
  NO_KOMMUNE_SLUG,
  shouldRedirectMunicipalityToByPage,
} from "@/lib/danmark-silo";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";
import { segmentSlugToName } from "@/lib/slug";
import { prepositionForRegionName } from "@/lib/area-db";
import { Fragment } from "react";
import { ShelterCard } from "@/components/ShelterCard";
import { AdInFeed } from "@/components/AdInFeed";
import { showInFeedAdAt } from "@/lib/adsense";
import { getWater, getToilet, getPetsAllowed } from "@/lib/shelter-detail";
import { isStructuredBookable } from "@shared/lib/shelter-detail";
import { generateMunicipalityPageFaq } from "@/lib/fakta-faq";
import { faqToJsonLd } from "@/lib/faq";
import type { Shelter } from "@/types/shelter";

interface PageProps {
  params: Promise<{ region: string; municipality: string }>;
}

export const dynamicParams = false;

/** ISR: cache og revalider hver 24. time. */
export const revalidate = 86400;

async function getMunicipalityPageContext(
  regionName: string,
  municipalityName: string | null
): Promise<{
  shelters: Shelter[];
  redirectBySlug: string | null;
}> {
  const shelters = await getSheltersInMunicipality(regionName, municipalityName);

  if (!municipalityName) {
    return { shelters, redirectBySlug: null };
  }

  const byLanding = await getByLandingData(municipalityName);
  const redirectBySlug = shouldRedirectMunicipalityToByPage(
    municipalityName,
    shelters,
    byLanding.shelters
  )
    ? slugifySegment(municipalityName)
    : null;

  return { shelters, redirectBySlug };
}

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
  const { shelters, redirectBySlug } = await getMunicipalityPageContext(
    regionName,
    municipalityName === "Ukendt kommune" ? null : municipalityName
  );
  const count = shelters.length;
  const bookable = shelters.filter((s) => isStructuredBookable(s)).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  // Kort titel (<60 tegn) så den ikke afkortes i Google. Detaljerne ligger i
  // description; titlen holder keyword + kommune + antal forrest.
  const title = count > 0
    ? `Shelter i ${municipalityName} Kommune – ${count} pladser | ShelterDK`
    : `Shelter i ${municipalityName} Kommune | ShelterDK`;
  const statParts: string[] = [];
  if (bookable > 0) statParts.push(`${bookable} kan bookes`);
  if (withWater > 0) statParts.push(`${withWater} med vand`);
  const statsText = statParts.length > 0 ? ` – ${statParts.join(", ")}` : "";
  const description = count > 0
    ? `Find shelter i ${municipalityName} Kommune. Se ${count} shelters${statsText}, med kort, faciliteter, billeder og lokale bysider.`
    : `Find shelter i ${municipalityName} Kommune med kort, faciliteter, billeder og praktisk info på ShelterDK.`;
  const canonicalPath = redirectBySlug
    ? `/by/${redirectBySlug}`
    : `/danmark/${regionSlug}/${municipalitySlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      // OG-billedet genereres dynamisk af ./opengraph-image.tsx (branded kort
      // med kommune + shelter-antal) i stedet for at hotlinke et generisk foto.
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
  placeLinks,
}: {
  shelters: Shelter[];
  displayName: string;
  regionName: string;
  regionSlug: string;
  placeLinks: { name: string; slug: string; count: number }[];
}) {
  const total = shelters.length;
  const withToilet = shelters.filter((s) => {
    const t = getToilet(s);
    return t && t !== "none" && t !== "unknown";
  }).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const withPets = shelters.filter((s) => getPetsAllowed(s) === true).length;
  const bookable = shelters.filter((s) => isStructuredBookable(s)).length;
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
        Shelters i {displayName} Kommune
      </h2>
      <p>
        I {displayName} Kommune {prep} {regionName} finder du {total} shelter{total !== 1 ? "s" : ""}{facilityText}.
        {avgRating && ` Den gennemsnitlige Google-rating er ${avgRating} stjerner baseret på ${rated.length} bedømte pladser.`}
        {" "}Kommunesiden samler alle shelters i kommunen, mens bysiderne giver dig de mere præcise
        oversigter over shelter i de enkelte byer og lokalområder.
      </p>
      <p>
        {bookable > 0 ? (
          <>Flere af pladserne i {displayName} Kommune kan bookes i forvejen via udinaturen.dk eller
          Naturstyrelsen, hvilket er praktisk i højsæsonen. </>
        ) : (
          <>De fleste shelters i {displayName} Kommune fungerer efter først-til-mølle-princippet,
          så det kan betale sig at komme tidligt, særligt i højsæsonen. </>
        )}
        Husk at følge lokal skiltning og regler for overnatning, og efterlad altid pladsen
        pænere end du fandt den.
      </p>
      <p>
        {placeLinks.length > 0 && (
          <>
            Populære bysider i kommunen:
            {" "}
            {placeLinks.map((place, index) => (
              <span key={place.slug}>
                <Link href={`/by/${place.slug}`} className="text-accent hover:underline">
                  Shelter {place.name}
                </Link>
                {index < placeLinks.length - 1 ? ", " : ". "}
              </span>
            ))}
          </>
        )}
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

  const { shelters: rawShelters, redirectBySlug } = await getMunicipalityPageContext(
    regionName,
    municipalityName
  );
  if (redirectBySlug) {
    permanentRedirect(`/by/${redirectBySlug}`);
  }
  const shelters = await enrichSheltersWithGooglePhotoRef(rawShelters);
  const displayName = municipalityName ?? "Ukendt kommune";

  const withToilet = shelters.filter((s) => {
    const t = getToilet(s);
    return t && t !== "none" && t !== "unknown";
  }).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const bookable = shelters.filter((s) => isStructuredBookable(s)).length;
  const freeCount = shelters.filter((s) => !isStructuredBookable(s)).length;

  const quickAnswer = buildQuickAnswer(`I ${displayName} Kommune`, {
    count: shelters.length,
    bookable,
    toilet: withToilet,
    water: withWater,
  });

  const municipalityFaq = generateMunicipalityPageFaq(displayName, {
    totalCount: shelters.length,
    freeCount,
    toiletCount: withToilet,
    waterCount: withWater,
  });
  const placeCounts = new Map<string, number>();
  for (const shelter of shelters) {
    const place = (shelter.place ?? "").trim();
    if (!place) continue;
    placeCounts.set(place, (placeCounts.get(place) ?? 0) + 1);
  }
  const placeLinks = [...placeCounts.entries()]
    .map(([name, count]) => ({ name, count, slug: slugifySegment(name) }))
    .filter((place) => place.slug)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "da"))
    .slice(0, 5);

  return (
    <>
    <BreadcrumbSchema items={[
      { label: "Hjem", href: "/" },
      { label: regionName, href: `/danmark/${regionSlug}` },
      { label: displayName },
    ]} />
  <ShelterListSchema
      name={`Shelters i ${displayName} Kommune, ${regionName}`}
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
            Shelters i {displayName} Kommune
          </h1>
          <p className="text-primary/80 text-lg">
            {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} i {displayName}, {regionName}.{" "}
            <Link href="/by" className="text-accent font-medium hover:underline">
              Se shelter efter by
            </Link>
          </p>
        </header>

        <QuickAnswer
          url={`https://shelterdk.dk/danmark/${regionSlug}/${municipalitySlug}`}
          heading={`Hurtigt svar om shelter i ${displayName} Kommune`}
          answer={quickAnswer}
          questionHint={`Siden besvarer spørgsmål som “shelter i ${displayName} Kommune”, “kan man booke shelter i ${displayName}” og “findes der shelter med toilet eller vand i ${displayName} Kommune”.`}
        />

        <section className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shelters.map((shelter, i) => (
              <Fragment key={shelter.id}>
                {showInFeedAdAt(i, shelters.length) && <AdInFeed />}
                <ShelterCard
                  shelter={shelter}
                  href={shelterHref(regionName, shelter.kommune ?? null, shelter.slug)}
                />
              </Fragment>
            ))}
          </div>
        </section>

        <MunicipalityProse
          shelters={shelters}
          displayName={displayName}
          regionName={regionName}
          regionSlug={regionSlug}
          placeLinks={placeLinks}
        />

        {/* FAQ with JSON-LD */}
        {shelters.length > 0 && (
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om shelters i {displayName}
            </h2>
            <dl className="space-y-6">
              {municipalityFaq.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(municipalityFaq)) }}
            />
          </section>
        )}
      </div>
    </div>
    </>
  );
}
