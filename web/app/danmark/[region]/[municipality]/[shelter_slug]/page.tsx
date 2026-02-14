import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getShelterBySlugInSilo,
  getReviews,
  getRegionKommunePairs,
  getMunicipalitiesInRegion,
  getSheltersForStaticParams,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import {
  getLongDescription,
  getPhotoUrls,
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
  getPetsAllowed,
} from "@/lib/shelter-detail";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";

interface PageProps {
  params: Promise<{ region: string; municipality: string; shelter_slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const shelters = await getSheltersForStaticParams();
  return shelters.map(({ region, kommune, slug }) => ({
    region: slugifySegment(region),
    municipality: kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG,
    shelter_slug: slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shelter_slug } = await params;
  const { shelter } = await getShelterBySlugInSilo(shelter_slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const longDesc = getLongDescription(shelter);
  const fallbackDesc = stripHtml(shelter.description)?.slice(0, 160) || null;
  const description =
    longDesc?.slice(0, 160) ||
    fallbackDesc ||
    `Shelter: ${shelter.title}. Overnatning i naturen i Danmark.`;

  return {
    title: `${shelter.title} | ShelterDK`,
    description,
    openGraph: {
      title: `${shelter.title} | ShelterDK`,
      description,
      siteName: "ShelterDK",
    },
  };
}

export default async function DanmarkShelterPage({ params }: PageProps) {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;

  const { shelter, region: shelterRegion, kommune: shelterKommune } = await getShelterBySlugInSilo(shelter_slug);
  if (!shelter) notFound();

  const pairs = await getRegionKommunePairs();
  const regions = [...new Set(pairs.map((p) => p.region))];
  const regionName = segmentSlugToName(regionSlug, regions);
  const municipalities = regionName ? await getMunicipalitiesInRegion(regionName) : [];
  const municipalityName =
    municipalitySlug === NO_KOMMUNE_SLUG
      ? null
      : segmentSlugToName(municipalitySlug, municipalities);

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

  const [reviews] = await Promise.all([
    getReviews(shelter.google_place_id ?? null),
  ]);

  const placeName = shelter.google_place_name ?? null;
  const showReviews = isShelterPlace(placeName);
  const city =
    getCity(shelter) ??
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const photoUrls = getPhotoUrls(shelter);
  const allPhotoUrls = photoUrls.length > 0 ? photoUrls : [];
  const displayDescription =
    getLongDescription(shelter) || stripHtml(shelter.description) || null;
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
  const toilet = getToilet(shelter);
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

  const breadcrumbs = [
    { label: "Hjem", href: "/" },
    { label: "Søg shelters", href: "/soeg" },
    { label: displayRegionName, href: `/danmark/${regionSlug}` },
    { label: displayMunicipalityName, href: `/danmark/${regionSlug}/${municipalitySlug}` },
    { label: shelter.title },
  ];

  return (
    <ShelterDetailContent
      shelter={shelter}
      slug={shelter_slug}
      breadcrumbs={breadcrumbs}
      city={city}
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
      isBookable={isBookable(shelter)}
      shelterFaqItems={shelterFaqItems}
      shelterFaqJsonLd={shelterFaqJsonLd}
      reviews={reviews}
      coords={coords}
    />
  );
}
