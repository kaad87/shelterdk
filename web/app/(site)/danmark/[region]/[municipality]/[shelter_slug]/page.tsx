import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getShelterBySlugInSilo,
  getShelterBySlugIncludingDuplicates,
  getCanonicalShelterForRedirect,
  getReviews,
  getRegionKommunePairs,
  getMunicipalitiesInRegion,
  getSheltersForStaticParams,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import type { Shelter } from "@/types/shelter";
import {
  getLongDescription,
  buildSeoTitle,
  getResolvedPhotoUrls,
  getCapacity,
  getFeatures,
  getSeason,
  getOwner,
  getContact,
  getAccessDescription,
  getLocationCoords,
  getCity,
  isShelterPlace,
  stripHtml,
  isBookable,
  getToilet,
  getWater,
  getPetsAllowed,
  isValidImageUrl,
  generateFallbackDescription,
  getFirewood,
} from "@/lib/shelter-detail";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import { getAreaBySlug, prepositionForArea } from "@/lib/area-db";
import { getWeatherForecast } from "@/lib/weather";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { getRoutesForShelter } from "@/lib/shelter-routes";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { NearbySheltersWithinRadius } from "@/components/NearbySheltersWithinRadius";

interface PageProps {
  params: Promise<{ region: string; municipality: string; shelter_slug: string }>;
}

// true = tillad on-demand rendering af shelters der ikke var med ved sidste build
export const dynamicParams = true;

/** ISR: cache 1 time for hurtig TTFB. Efter første load serveres siden fra cache. */
export const revalidate = 86400;

export async function generateStaticParams() {
  const shelters = await getSheltersForStaticParams();
  return shelters.map(({ region, kommune, slug }) => ({
    region: slugifySegment(region),
    municipality: kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG,
    shelter_slug: slug,
  }));
}

/** Kort SEO-beskrivelse ud fra shelterets faciliteter (samme logik som /shelter/[slug]). */
function buildDescriptionFromFacilities(shelter: Shelter): string {
  const region = (shelter.region ?? "").trim() || "Danmark";
  const parts: string[] = [];
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  if (toilet === "flush") parts.push("toilet");
  else if (toilet === "mulch") parts.push("komposttoilet");
  if (water === true) parts.push("vand");
  if (isBookable(shelter)) parts.push("bookbar");
  const facilityStr = parts.length > 0 ? ` Med ${parts.join(", ")}.` : "";
  const longDesc = getLongDescription(shelter);
  const fallbackDesc = stripHtml(shelter.description)?.slice(0, 120) || null;
  const extra = longDesc?.slice(0, 120) || fallbackDesc || "Overnatning i naturen.";
  return `${shelter.title} – book shelter i ${region}.${facilityStr} ${extra}`.slice(0, 160);
}

const getCachedShelterInSilo = cache(getShelterBySlugInSilo);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;
  const { shelter } = await getCachedShelterInSilo(shelter_slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const title =
    (shelter.seo_title?.trim() || null) ?? buildSeoTitle(shelter);
  const description = buildDescriptionFromFacilities(shelter);
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}/${shelter_slug}`;

  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const photoRef = Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null;
  const photoUrls = getResolvedPhotoUrls(shelter, photoRef);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shelterdk.dk";
  const ogImageRaw =
    photoUrls.length > 0 && (photoUrls[0].startsWith("/") || isValidImageUrl(photoUrls[0]))
      ? photoUrls[0]
      : undefined;
  const ogImage = ogImageRaw?.startsWith("/") ? `${baseUrl}${ogImageRaw}` : ogImageRaw;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title,
      description,
      siteName: "ShelterDK",
      type: "website",
      url: `https://shelterdk.dk${canonicalPath}`,
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: shelter.title }],
      }),
    },
  };
}

export default async function DanmarkShelterPage({ params }: PageProps) {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;

  let result = await getCachedShelterInSilo(shelter_slug);
  if (!result.shelter) {
    // Fallback: slug kan matche en duplicate – redirect til kanonisk shelter
    const fallback = await getShelterBySlugIncludingDuplicates(shelter_slug);
    if (!fallback.shelter) notFound();
    const dupId = (fallback.shelter as { duplicate_of_shelter_id?: string | null }).duplicate_of_shelter_id;
    if (dupId) {
      const canonical = await getCanonicalShelterForRedirect(dupId);
      if (canonical) {
        const regionSlug = slugifySegment(canonical.region);
        const municipalitySlug = canonical.kommune ? slugifySegment(canonical.kommune) : NO_KOMMUNE_SLUG;
        redirect(`/danmark/${regionSlug}/${municipalitySlug}/${canonical.slug}`);
      }
      // Duplicate uden funden kanonisk – undgå loop
      notFound();
    }
    // Ikke-duplicate: vis på /shelter (har evt. ikke region)
    redirect(`/shelter/${shelter_slug}`);
  }
  const { shelter, region: shelterRegion, kommune: shelterKommune } = result;

  const pairs = await getRegionKommunePairs();
  const regions = [...new Set(pairs.map((p) => p.region))];
  const regionName = segmentSlugToName(regionSlug, regions);

  const expectedRegionSlug = shelterRegion ? slugifySegment(shelterRegion) : null;
  const expectedMunicipalitySlug = shelterKommune
    ? slugifySegment(shelterKommune)
    : NO_KOMMUNE_SLUG;

  if (
    expectedRegionSlug &&
    expectedMunicipalitySlug &&
    (regionSlug !== expectedRegionSlug || municipalitySlug !== expectedMunicipalitySlug)
  ) {
    redirect(`/danmark/${expectedRegionSlug}/${expectedMunicipalitySlug}/${shelter_slug}`);
  }

  const areaSlug = (shelter as { area_slug?: string | null }).area_slug?.trim() || null;
  const [municipalitiesResult, reviews, area] = await Promise.all([
    regionName ? getMunicipalitiesInRegion(regionName) : Promise.resolve([]),
    getReviews(shelter.google_place_id ?? null),
    areaSlug ? getAreaBySlug(areaSlug) : Promise.resolve(null),
  ]);
  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const photoRef = Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null;
  const coordsEarly = getLocationCoords(shelter);
  const weatherForecast = coordsEarly
    ? await getWeatherForecast(coordsEarly.lat, coordsEarly.lon)
    : null;
  const municipalityName =
    municipalitySlug === NO_KOMMUNE_SLUG
      ? null
      : segmentSlugToName(municipalitySlug, municipalitiesResult);

  const placeName = shelter.google_place_name ?? null;
  const showReviews = isShelterPlace(placeName);
  const city =
    getCity(shelter) ??
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const photoUrls = getResolvedPhotoUrls(shelter, photoRef);
  const allPhotoUrls = photoUrls.length > 0 ? photoUrls : [];
  const displayDescription =
    (shelter.seo_description?.trim() ? stripHtml(shelter.seo_description) : null) ||
    getLongDescription(shelter) ||
    stripHtml(shelter.description) ||
    generateFallbackDescription(shelter);
  const capacity = getCapacity(shelter);
  const features = getFeatures(shelter);
  const season = getSeason(shelter);
  const owner = getOwner(shelter);
  const contact = getContact(shelter);
  const accessDesc = getAccessDescription(shelter);
  const coords = getLocationCoords(shelter);
  const mapUrl = coords
    ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=15/${coords.lat}/${coords.lon}`
    : null;
  const googleMapsUrl = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lon}`
    : shelter.google_place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shelter.title)}&query_place_id=${encodeURIComponent(shelter.google_place_id)}`
      : null;
  const rawBookingUrl = shelter.booking_url?.trim() || null;
  const bookingUrl =
    rawBookingUrl && /^https?:\/\//i.test(rawBookingUrl) ? rawBookingUrl : null;
  const bookingFallbackHint =
    !bookingUrl &&
    isBookable(shelter) &&
    ((owner || "").toLowerCase().includes("naturstyrelsen") || (contact || "").toLowerCase().includes("nst.dk"))
      ? "naturstyrelsen"
      : null;
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const facilityLinks: { label: string; href: string }[] = [];
  if (toilet === "flush" || toilet === "mulch") facilityLinks.push({ label: "Se shelters med toilet", href: "/shelter-med-toilet" });
  if (water === true) facilityLinks.push({ label: "Se shelters med vand", href: "/shelter-med-vand" });
  const petsAllowed = getPetsAllowed(shelter);
  const shelterFaqItems = getShelterFaqItems(shelter.title, {
    toilet,
    bookable: isBookable(shelter),
    bookingUrl,
    petsAllowed,
  });
  const shelterFaqJsonLd =
    shelterFaqItems.length > 0 ? JSON.stringify(faqToJsonLd(shelterFaqItems)) : undefined;

  const displayRegionName = regionName ?? shelterRegion ?? "Danmark";
  const displayMunicipalityName = municipalityName ?? shelterKommune ?? "Ukendt kommune";

  // Breadcrumbs prioriterer altid Danmark-silo (region → kommune). Område vises separat på siden.
  const breadcrumbs = [
    { label: "Hjem", href: "/" },
    { label: displayRegionName, href: `/danmark/${regionSlug}` },
    { label: displayMunicipalityName, href: `/danmark/${regionSlug}/${municipalitySlug}` },
    { label: shelter.title },
  ];

  const breadcrumbSchemaItems: { label: string; href?: string }[] = breadcrumbs.map((b) =>
    b.href ? { label: b.label, href: b.href } : { label: b.label }
  );
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}/${shelter_slug}`;

  return (
    <>
      <ShelterSchema shelter={shelter} canonicalPath={canonicalPath} />
      <BreadcrumbSchema items={breadcrumbSchemaItems} />
      <ShelterDetailContent
        shelter={shelter}
        slug={shelter_slug}
        breadcrumbs={breadcrumbs}
        city={city}
        areaSlug={area ? areaSlug : undefined}
        areaName={area?.name ?? undefined}
        areaPreposition={area ? prepositionForArea(area) : undefined}
      showReviews={showReviews}
      allPhotoUrls={allPhotoUrls}
      displayDescription={displayDescription}
      capacity={capacity}
      features={features}
      season={season}
      owner={owner}
      contact={contact}
      accessDesc={accessDesc}
      mapUrl={mapUrl}
      googleMapsUrl={googleMapsUrl}
      bookingUrl={bookingUrl}
      bookingFallbackHint={bookingFallbackHint}
      firewood={getFirewood(shelter)}
      facilityLinks={facilityLinks}
      nearbyRoutes={getRoutesForShelter(shelter_slug)}
      isBookable={isBookable(shelter)}
      shelterFaqItems={shelterFaqItems}
      shelterFaqJsonLd={shelterFaqJsonLd}
      reviews={reviews}
      coords={coords}
      weatherForecast={weatherForecast}
      />
      <Suspense
        fallback={
          <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 border-t border-primary/10">
            <div className="h-8 w-48 bg-primary/5 rounded animate-pulse" aria-hidden />
          </section>
        }
      >
        <NearbySheltersWithinRadius
          shelterId={shelter.id}
          limit={5}
          coords={coords}
        />
      </Suspense>
    </>
  );
}
