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
  buildShelterDescription,
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
  getResolvedBookingModel,
  getToilet,
  getWater,
  getPetsAllowed,
  isValidImageUrl,
  generateFallbackDescription,
  getFirewood,
} from "@/lib/shelter-detail";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import { chooseMetaDescription, normalizeSeoTitle, DEFAULT_OG_IMAGE } from "@/lib/seo-meta";
import { getAreaBySlug, prepositionForArea } from "@/lib/area-db";
import { getWeatherForecast } from "@/lib/weather";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { getRoutesForShelter } from "@/lib/shelter-routes";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { NearbySheltersWithinRadius } from "@/components/NearbySheltersWithinRadius";
import { listBookableSheltersByShelterDbId } from "@/lib/booking-db";

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

const getCachedShelterInSilo = cache(getShelterBySlugInSilo);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;
  const { shelter } = await getCachedShelterInSilo(shelter_slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const title = normalizeSeoTitle(shelter.seo_title, buildSeoTitle(shelter));
  const description = chooseMetaDescription(
    shelter.seo_description ? stripHtml(shelter.seo_description) : null,
    buildShelterDescription(shelter)
  );
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}/${shelter_slug}`;

  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const photoRef = Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null;
  const photoUrls = getResolvedPhotoUrls(shelter, photoRef);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
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
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: shelter.title }]
        : [DEFAULT_OG_IMAGE],
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
  const [municipalitiesResult, reviews, area, bookableShelters] = await Promise.all([
    regionName ? getMunicipalitiesInRegion(regionName) : Promise.resolve([]),
    getReviews(shelter.google_place_id ?? null),
    areaSlug ? getAreaBySlug(areaSlug) : Promise.resolve(null),
    listBookableSheltersByShelterDbId(shelter.id).catch(() => []),
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

  const googlePlaceName = shelter.google_place_name ?? null;
  const showReviews = isShelterPlace(googlePlaceName);
  const placeName = (shelter.place ?? "").trim() || null;
  const placeSlug = placeName ? slugifySegment(placeName) : null;
  const city =
    getCity(shelter) ??
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const photoUrls = getResolvedPhotoUrls(shelter, photoRef);
  const allPhotoUrls = photoUrls.length > 0 ? photoUrls : [];
  const displayDescription =
    getLongDescription(shelter) ||
    stripHtml(shelter.description) ||
    (shelter.seo_description?.trim() ? stripHtml(shelter.seo_description) : null) ||
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
  const bookingModel = getResolvedBookingModel(shelter, {
    hasShelterDkBooking: bookableShelters.length > 0,
  });
  const bookingUrl = bookingModel.bookingUrl;
  const bookingFallbackHint = bookingModel.fallbackHint;
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const facilityLinks: { label: string; href: string }[] = [];
  if (toilet === "flush" || toilet === "mulch") facilityLinks.push({ label: "Se shelters med toilet", href: "/shelter-med-toilet" });
  if (water === true) facilityLinks.push({ label: "Se shelters med vand", href: "/shelter-med-vand" });
  const petsAllowed = getPetsAllowed(shelter);
  const shelterFaqItems = getShelterFaqItems(shelter.title, {
    toilet,
    bookable: bookingModel.requiresBooking,
    bookingUrl,
    petsAllowed,
    hasShelterDkBooking: bookingModel.hasShelterDkBooking,
    bookingHint: bookingModel.fallbackHint === "naturstyrelsen" ? "naturstyrelsen" : null,
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
      <ShelterSchema shelter={shelter} canonicalPath={canonicalPath} reviews={reviews} />
      <BreadcrumbSchema items={breadcrumbSchemaItems} />
      <ShelterDetailContent
        shelter={shelter}
        slug={shelter_slug}
        breadcrumbs={breadcrumbs}
        city={city}
        placeName={placeName}
        placeSlug={placeSlug}
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
      bookingUnits={bookableShelters.map((unit) => ({
        id: unit.id,
        title: unit.title,
        href: unit.booking_mode === "shelterdk"
          ? `/book/${unit.slug}`
          : `/embed/book/${unit.slug}`,
        maxPersons: unit.max_persons,
      }))}
      bookingFallbackHint={bookingFallbackHint}
      firewood={getFirewood(shelter)}
      facilityLinks={facilityLinks}
      nearbyRoutes={getRoutesForShelter(shelter_slug)}
      isBookable={bookingModel.requiresBooking}
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
