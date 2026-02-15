import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/utils/supabase/server-public";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import type { Shelter } from "@/types/shelter";
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
import { slugifySegment } from "@/lib/slug";
import { NO_KOMMUNE_SLUG } from "@/lib/danmark-silo";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { NearbyShelters } from "@/components/NearbyShelters";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const SHELTER_SELECT_DETAIL =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, region, kommune, place, toilet, water, geofa_raw";
const SHELTER_SELECT_DETAIL_FALLBACK =
  "id, title, slug, description, location, image_url, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, region, water, geofa_raw";

async function getShelterBySlug(slug: string): Promise<Shelter | null> {
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const shelter = await getShelterBySlug(slug);
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
    alternates: { canonical: `https://shelterdk.dk/shelter/${slug}` },
    openGraph: {
      title: `${shelter.title} | ShelterDK`,
      description,
      siteName: "ShelterDK",
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
    redirect(`/danmark/${regionSlug}/${municipalitySlug}/${slug}`);
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
  let bookingUrl =
    rawBookingUrl && /^https?:\/\//i.test(rawBookingUrl) ? rawBookingUrl : null;
  // Fallback: Naturstyrelsen-shelters uden booking_url – prøv book.naturstyrelsen.dk/sted/{slug}
  if (!bookingUrl && isBookable(shelter)) {
    const o = (owner || "").toLowerCase();
    const c = (contact || "").toLowerCase();
    if (o.includes("naturstyrelsen") || c.includes("nst.dk")) {
      const derived = slug.replace(/-[0-9]+$/, "");
      if (derived) {
        bookingUrl = `https://book.naturstyrelsen.dk/sted/${derived}/`;
      }
    }
  }
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

  const breadcrumbs = [
    { label: "Hjem", href: "/" },
    { label: "Søg shelters", href: "/soeg" },
    ...(city ? [{ label: city, href: undefined }] : []),
    { label: shelter.title },
  ].filter((b): b is { label: string; href?: string } => typeof b.label === "string");

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
      {coords && (
        <NearbyShelters
          lat={coords.lat}
          lng={coords.lon}
          excludeId={shelter.id}
          limit={5}
        />
      )}
    </>
  );
}
