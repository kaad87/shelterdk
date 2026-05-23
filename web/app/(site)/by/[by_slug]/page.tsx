import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { ChevronRight } from "lucide-react";
import {
  getByLandingData,
  getDistinctByLandingPages,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";
import { segmentSlugToName } from "@/lib/slug";
import { ByShelterExplorer } from "@/components/ByShelterExplorer";
import { getWater, getToilet } from "@/lib/shelter-detail";
import { generatePlacePageFaq } from "@/lib/fakta-faq";
import { faqToJsonLd } from "@/lib/faq";
import type { SoegFilters } from "@/lib/soeg-db";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";
import { CityDestinationSchema } from "@/components/seo/CityDestinationSchema";
import { newestIsoDate } from "@/lib/content-dates";
import { getCityEditorial } from "@/lib/city-editorial";

interface PageProps {
  params: Promise<{ by_slug: string }>;
  searchParams: Promise<{
    view?: string;
    billede?: string;
    anmeldelser?: string;
    bookbar?: string;
    vand?: string;
    toilet?: string;
    hund?: string;
    baalplads?: string;
    gratis?: string;
    handicap?: string;
    bord_baenk?: string;
    strand?: string;
    bruser?: string;
    min_pladser?: string;
  }>;
}

export const dynamicParams = false;

export const revalidate = 86400;

type ViewMode = "list" | "map" | "split";

function parseFilters(params: Awaited<PageProps["searchParams"]>): SoegFilters {
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
  // `gratis` parses bevidst IKKE — se kommentar i app/api/soeg/route.ts.
  if (params.handicap === "1") filters.handicap = true;
  const minPladser = parseInt(params.min_pladser ?? "0", 10);
  if (minPladser > 0) filters.min_pladser = minPladser;
  return filters;
}

export async function generateStaticParams() {
  const places = await getDistinctByLandingPages(1);
  return places.map(({ place }) => ({ by_slug: slugifySegment(place) }));
}

const resolvePlaceName = cache(async (slug: string): Promise<string | null> => {
  const places = await getDistinctByLandingPages(1);
  return segmentSlugToName(slug, places.map((p) => p.place));
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { by_slug } = await params;
  const placeName = await resolvePlaceName(by_slug);
  if (!placeName) return { title: { absolute: "By ikke fundet" } };

  const { shelters, usesMunicipalityExpansion } = await getByLandingData(placeName);
  const count = shelters.length;
  const bookable = shelters.filter((s) => !!s.booking_url && String(s.booking_url).trim() !== "").length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const locationLabel = usesMunicipalityExpansion ? `i og omkring ${placeName}` : `i ${placeName}`;

  // "Gratis"-tal fjernet bevidst — payment-data er for upålideligt.
  // Title bygges på shelter-tal + bookbare i stedet, som er pålideligt.
  const titleBits: string[] = [];
  if (count > 0) titleBits.push(`${count} pladser`);
  if (bookable > 0) titleBits.push(`${bookable} bookbare`);
  const title = count > 0
    ? `Shelter i ${placeName} ${new Date().getFullYear()} – ${titleBits.join(", ")} | ShelterDK`
    : `Shelter i ${placeName} – kort og faciliteter | ShelterDK`;
  const statParts: string[] = [];
  if (bookable > 0) statParts.push(`${bookable} kan bookes`);
  if (withWater > 0) statParts.push(`${withWater} med vand`);
  const statsText = statParts.length > 0 ? ` – ${statParts.join(", ")}` : "";
  const description = count > 0
    ? `Find shelter i ${placeName}. Se ${count} shelter${count !== 1 ? "s" : ""} ${locationLabel}${statsText}, med kort, faciliteter, billeder og praktisk info.`
    : `Find shelter i ${placeName} med kort, faciliteter, billeder og praktisk info på ShelterDK.`;

  const canonicalPath = `/by/${by_slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      // OG image is generated dynamically by ./opengraph-image.tsx so each
      // city gets a card with its actual shelter count + booking breakdown.
    },
    ...(count === 0 && { robots: { index: false, follow: true } }),
  };
}

function shelterHref(region: string | null | undefined, kommune: string | null | undefined, slug: string): string {
  if (!region) return `/by`;
  const r = slugifySegment(region);
  const m = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${r}/${m}/${slug}`;
}

function ByProse({
  placeName,
  shelterCount,
  withToilet,
  withWater,
  bookable,
  freeCount,
  kommuneLinks,
  usesMunicipalityExpansion,
}: {
  placeName: string;
  shelterCount: number;
  withToilet: number;
  withWater: number;
  bookable: number;
  freeCount: number;
  kommuneLinks: { name: string; slug: string; regionSlug: string }[];
  usesMunicipalityExpansion: boolean;
}) {
  const parts: string[] = [];
  if (withToilet > 0) parts.push(`${withToilet} har toilet`);
  if (withWater > 0) parts.push(`${withWater} har adgang til vand`);
  if (bookable > 0) parts.push(`${bookable} kan bookes online`);
  const facilityText = parts.length > 0 ? `, hvoraf ${parts.join(", ")}` : "";
  const locationLabel = usesMunicipalityExpansion ? `i og omkring ${placeName}` : `i ${placeName}`;

  return (
    <section className="prose prose-primary max-w-none text-primary/90">
      <h2 className="font-serif text-xl font-bold text-primary mb-4">
        Shelter {placeName}
      </h2>
      <p>
        Leder du efter shelter i {placeName}, finder du her {shelterCount} shelter{shelterCount !== 1 ? "s" : ""} {locationLabel}{facilityText}.{" "}
        {freeCount > 0 && `${freeCount} af pladserne er gratis og fungerer efter først-til-mølle-princippet. `}
        Siden er lavet som en samlet oversigt over shelters i byen, så du hurtigt kan sammenligne pladser,
        faciliteter og bookingmuligheder.
      </p>
      <p>
        {bookable > 0 ? (
          <>Flere af pladserne i {placeName} kan bookes i forvejen via udinaturen.dk eller
          Naturstyrelsen, hvilket er praktisk i højsæsonen. </>
        ) : (
          <>De fleste shelters i {placeName} fungerer efter først-til-mølle-princippet,
          så det kan betale sig at komme tidligt, særligt i højsæsonen. </>
        )}
        Husk at følge lokal skiltning og regler for overnatning, og efterlad altid pladsen
        pænere end du fandt den.
      </p>
      {kommuneLinks.length > 0 && (
        <p>
          Se også de tilhørende kommune-oversigter for{" "}
          {kommuneLinks.map((k, i) => (
            <span key={k.slug}>
              <Link href={`/danmark/${k.regionSlug}/${k.slug}`} className="text-accent hover:underline">
                {k.name} Kommune
              </Link>
              {i < kommuneLinks.length - 1 ? ", " : ""}
            </span>
          ))}
          . Du kan også udforske shelters med specifikke faciliteter:{" "}
          <Link href="/shelter-med-toilet" className="text-accent hover:underline">toilet</Link>,{" "}
          <Link href="/shelter-med-vand" className="text-accent hover:underline">vand</Link>,{" "}
          <Link href="/shelter-med-hund" className="text-accent hover:underline">hund</Link>{" "}
          eller{" "}
          <Link href="/shelter-med-baalplads" className="text-accent hover:underline">bålplads</Link>.
        </p>
      )}
    </section>
  );
}

export default async function ByPage({ params, searchParams }: PageProps) {
  const { by_slug } = await params;
  const urlParams = await searchParams;
  const placeName = await resolvePlaceName(by_slug);
  if (!placeName) notFound();

  const viewParam = (urlParams.view ?? "split").toLowerCase();
  const initialView: ViewMode =
    viewParam === "map" ? "map" : viewParam === "list" ? "list" : "split";
  const initialFilters = parseFilters(urlParams);

  const { shelters: mergedShelters, usesMunicipalityExpansion } = await getByLandingData(placeName);
  const shelters = await enrichSheltersWithGooglePhotoRef(mergedShelters);

  if (shelters.length === 0) notFound();

  const withToilet = shelters.filter((s) => {
    const t = getToilet(s);
    return t && t !== "none" && t !== "unknown";
  }).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const bookable = shelters.filter((s) => !!s.booking_url && String(s.booking_url).trim() !== "").length;
  // freeCount er beholdt som 0-fallback fordi byFaq/ByProse stadig accepterer
  // det som prop — vi sender bare 0 så de tilhørende sætninger om "X gratis"
  // ikke rendres mens payment-data er upålideligt.
  const freeCount = 0;
  const cityEditorial = getCityEditorial(placeName);

  // Build unique kommune links for contextual linking
  const kommuneMap = new Map<string, { name: string; slug: string; regionSlug: string }>();
  for (const s of shelters) {
    if (s.kommune && s.region) {
      if (s.kommune === placeName) continue;
      const key = s.kommune;
      if (!kommuneMap.has(key)) {
        kommuneMap.set(key, {
          name: s.kommune,
          slug: slugifySegment(s.kommune),
          regionSlug: slugifySegment(s.region),
        });
      }
    }
  }
  const kommuneLinks = [...kommuneMap.values()].slice(0, 3);

  const byFaq = generatePlacePageFaq(placeName, {
    totalCount: shelters.length,
    freeCount,
    toiletCount: withToilet,
    waterCount: withWater,
    bookableCount: bookable,
  });
  const lastVerified = newestIsoDate(...shelters.map((shelter) => shelter.updated_at ?? shelter.created_at));
  const quickAnswer = `I ${placeName} finder du ${shelters.length} shelter${shelters.length !== 1 ? "s" : ""}${bookable > 0 ? `, hvor ${bookable} kan bookes` : ""}${withToilet > 0 ? ` og ${withToilet} har toilet` : ""}${withWater > 0 ? `, mens ${withWater} har adgang til vand` : ""}.`;

  return (
    <>
      <BreadcrumbSchema items={[
        { label: "Hjem", href: "/" },
        { label: "Byer", href: "/by" },
        { label: `Shelter ${placeName}` },
      ]} />
      <SpeakableSchema url={`https://shelterdk.dk/by/${by_slug}`} selectors={[".llm-quote"]} />
      <ShelterListSchema
        name={`Shelter ${placeName}`}
        shelters={shelters}
        hrefFn={(s) => {
          const full = shelters.find((x) => x.id === s.id);
          return shelterHref(full?.region, full?.kommune, s.slug);
        }}
      />
      <CityDestinationSchema
        placeName={placeName}
        citySlug={by_slug}
        shelters={shelters}
        hrefFn={(s) => {
          const full = shelters.find((x) => x.id === s.id);
          return shelterHref(full?.region, full?.kommune, s.slug);
        }}
        description={cityEditorial?.summary}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Hjem
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/by" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Byer
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <span className="text-primary font-medium">Shelter {placeName}</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
              Shelter {placeName}
            </h1>
            <p className="text-primary/80 text-lg">
              {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} {usesMunicipalityExpansion ? `i og omkring ${placeName}` : `i ${placeName}`}.{" "}
              <Link href="/by" className="text-accent font-medium hover:underline">
                Se flere bysider
              </Link>
            </p>
            <div className="mt-4">
              <LastVerifiedBadge isoDate={lastVerified} />
            </div>
          </header>

          <section className="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-6">
            <h2 className="font-serif text-2xl font-bold text-primary mb-3">
              Hurtigt svar om shelter i {placeName}
            </h2>
            <p className="llm-quote text-primary/85 leading-relaxed">{quickAnswer}</p>
            <p className="mt-3 text-sm text-primary/60">
              Siden er lavet til lokale spørgsmål som “shelter i {placeName}”, “kan man booke shelter i {placeName}” og “findes der shelter med toilet eller vand {usesMunicipalityExpansion ? `i området` : `i byen`}”.
            </p>
          </section>

          {cityEditorial ? (
            <section className="mb-8 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-2xl font-bold text-primary mb-3">
                Om shelter-livet i {placeName}
              </h2>
              <p className="text-primary/85 leading-relaxed">
                {cityEditorial.summary}
              </p>
              <p className="mt-3 text-sm text-primary/70">
                I området omkring {placeName} er det især relevant at kigge mod {cityEditorial.nearbyPois.join(", ")}.
              </p>
              <p className="mt-3 text-sm text-primary/60">
                Brug by-siden som hurtig lokal indgang, og klik videre til den enkelte shelterplads for billeder, booking og praktiske detaljer.
              </p>
            </section>
          ) : null}

          <ByShelterExplorer
            placeName={placeName}
            shelters={shelters}
            initialView={initialView}
            initialFilters={initialFilters}
          />

          <ByProse
            placeName={placeName}
            shelterCount={shelters.length}
            withToilet={withToilet}
            withWater={withWater}
            bookable={bookable}
            freeCount={freeCount}
            kommuneLinks={kommuneLinks}
            usesMunicipalityExpansion={usesMunicipalityExpansion}
          />

          {shelters.length > 0 && (
            <section className="mt-12 pt-8 border-t border-primary/10">
              <h2 className="font-serif text-xl font-bold text-primary mb-6">
                Ofte stillede spørgsmål om shelter i {placeName}
              </h2>
              <dl className="space-y-6">
                {byFaq.map((item) => (
                  <div key={item.question}>
                    <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                    <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                  </div>
                ))}
              </dl>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(byFaq)) }}
              />
              <p className="mt-6 text-sm text-primary/55">
                Oplysningerne bygger på ShelterDKs sheltersider og offentlige datakilder som GeoFA, Naturstyrelsen og udinaturen.dk.
                Brug oversigten her som lokal indgang, og klik videre til den enkelte shelterside for booking, billeder og praktiske detaljer.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
