import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { createPublicClient } from "@/utils/supabase/server-public";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import type { Shelter } from "@/types/shelter";
import {
  getLongDescription,
  buildSeoTitle,
  getPhotoUrls,
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
  getFirewood,
} from "@/lib/shelter-detail";
import { slugifySegment } from "@/lib/slug";
import { NO_KOMMUNE_SLUG } from "@/lib/danmark-silo";
import { getAreaBySlug } from "@/lib/area-db";
import { getWeatherForecast } from "@/lib/weather";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { NearbySheltersWithinRadius } from "@/components/NearbySheltersWithinRadius";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** ISR: cache 1 time for hurtig TTFB. */
export const revalidate = 86400;

const SHELTER_SELECT_DETAIL =
  "id, title, slug, seo_title, description, seo_description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, water, geofa_raw, area_slug, google_places!shelters_google_place_id_fkey(photo_references)";
const SHELTER_SELECT_DETAIL_FALLBACK =
  "id, title, slug, description, seo_description, location, image_url, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, geofa_raw, area_slug, google_places!shelters_google_place_id_fkey(photo_references)";

async function getShelterBySlugUncached(slug: string): Promise<Shelter | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_DETAIL)
    .eq("slug", slug)
    .single();
  if (!error && data) return data as Shelter;
  if (error?.code === "42703") {
    const { data: fallback } = await supabase
      .from("shelters")
      .select(SHELTER_SELECT_DETAIL_FALLBACK)
      .eq("slug", slug)
      .single();
    if (fallback) return fallback as Shelter;
  }
  return null;
}

const getShelterBySlug = cache(getShelterBySlugUncached);

async function getReviews(googlePlaceId: string | null) {
  if (!googlePlaceId) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("google_place_reviews")
    .select("author_name, rating, text, relative_time_description, time")
    .eq("google_place_id", googlePlaceId)
    .order("time", { ascending: false })
    .limit(5);
  return (data || []) as {
    author_name: string | null;
    rating: number | null;
    text: string | null;
    relative_time_description: string | null;
    time: string | null;
  }[];
}

/** Byg en kort SEO-beskrivelse ud fra shelterets faciliteter. */
function buildDescriptionFromFacilities(shelter: Shelter): string {
  const region = (shelter.region ?? "").trim() || "Danmark";
  const parts: string[] = [];
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  if (toilet === "flush") parts.push("toilet");
  else if (toilet === "mulch") parts.push("komposttoilet");
  if (water === true) parts.push("vand");
  if (isBookable(shelter)) parts.push("bookbar");
  const facilityStr =
    parts.length > 0 ? ` Med ${parts.join(", ")}.` : "";
  const longDesc = getLongDescription(shelter);
  const fallbackDesc = stripHtml(shelter.description)?.slice(0, 120) || null;
  const extra =
    longDesc?.slice(0, 120) || fallbackDesc || "Overnatning i naturen.";
  return `${shelter.title} – book shelter i ${region}.${facilityStr} ${extra}`.slice(0, 160);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const shelter = await getShelterBySlug(slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const title =
    (shelter.seo_title?.trim() || null) ?? buildSeoTitle(shelter);
  const description = buildDescriptionFromFacilities(shelter);

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
    alternates: { canonical: `https://shelterdk.dk/shelter/${slug}` },
    openGraph: {
      title,
      description,
      siteName: "ShelterDK",
      type: "website",
      url: `https://shelterdk.dk/shelter/${slug}`,
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: shelter.title }],
      }),
    },
  };
}

export default async function ShelterPage({ params }: PageProps) {
  const { slug } = await params;
  const shelter = await getShelterBySlug(slug);

  if (!shelter) notFound();

  const region = (shelter.region ?? "").trim();
  const kommune = shelter.kommune && String(shelter.kommune).trim() ? String(shelter.kommune).trim() : null;
  if (region) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    permanentRedirect(`/danmark/${regionSlug}/${municipalitySlug}/${slug}`);
  }

  const areaSlug = (shelter as { area_slug?: string | null }).area_slug?.trim() || null;
  const [reviews, area] = await Promise.all([
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
    null;
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
  // Naturstyrelsen + bookbar men ingen booking_url: vis link til forsiden (undgå 404 fra gættet /sted/slug)
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

  // /shelter bruges kun når vi ikke har region-silo. Breadcrumbs følger derfor søgning som primær sti.
  // Område vises separat på siden.
  const breadcrumbs = [
    { label: "Hjem", href: "/" },
    { label: "Søg shelters", href: "/soeg" },
    { label: shelter.title },
  ];

  const breadcrumbSchemaItems: { label: string; href?: string }[] = breadcrumbs.map((b) =>
    b.href ? { label: b.label, href: b.href } : { label: b.label }
  );
  return (
    <>
      <ShelterSchema shelter={shelter} canonicalPath={`/shelter/${slug}`} />
      <BreadcrumbSchema items={breadcrumbSchemaItems} />
      <ShelterDetailContent
      shelter={shelter}
      slug={slug}
      breadcrumbs={breadcrumbs}
      city={city}
      areaSlug={area ? areaSlug : undefined}
      areaName={area?.name ?? undefined}
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
