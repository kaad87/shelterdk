import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
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
  getWater,
  getPetsAllowed,
  isValidImageUrl,
} from "@/lib/shelter-detail";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import { getAreaBySlug } from "@/lib/area-db";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { NearbySheltersWithinRadius } from "@/components/NearbySheltersWithinRadius";

interface PageProps {
  params: Promise<{ region: string; municipality: string; shelter_slug: string }>;
}

// true = tillad on-demand rendering af shelters der ikke var med ved sidste build
export const dynamicParams = true;

/** ISR: cache side og revalider i baggrunden hver 24. time for hurtig TTFB. */
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;
  const { shelter } = await getShelterBySlugInSilo(shelter_slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const region = (shelter.region ?? "").trim() || "Danmark";
  const title = `${shelter.title} - Book shelter i ${region}`;
  const description = buildDescriptionFromFacilities(shelter);
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}/${shelter_slug}`;

  const photoUrls = getPhotoUrls(shelter);
  const ogImage =
    photoUrls.length > 0 && isValidImageUrl(photoUrls[0])
      ? photoUrls[0]
      : shelter.image_url && isValidImageUrl(shelter.image_url)
        ? shelter.image_url
        : undefined;

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

  let result = await getShelterBySlugInSilo(shelter_slug);
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

  const areaSlug = (shelter as { area_slug?: string | null }).area_slug?.trim() || null;
  const [reviews, area] = await Promise.all([
    getReviews(shelter.google_place_id ?? null),
    areaSlug ? getAreaBySlug(areaSlug) : Promise.resolve(null),
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
  const bookingFallbackHint =
    !bookingUrl &&
    isBookable(shelter) &&
    ((owner || "").toLowerCase().includes("naturstyrelsen") || (contact || "").toLowerCase().includes("nst.dk"))
      ? "naturstyrelsen"
      : null;
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

  const breadcrumbs = area
    ? [
        { label: "Forside", href: "/" },
        { label: "Områder", href: "/omraade" },
        { label: area.name, href: `/omraade/${areaSlug}` },
        { label: shelter.title },
      ]
    : [
        { label: "Hjem", href: "/" },
        { label: "Søg shelters", href: "/soeg" },
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
      isBookable={isBookable(shelter)}
      shelterFaqItems={shelterFaqItems}
      shelterFaqJsonLd={shelterFaqJsonLd}
      reviews={reviews}
      coords={coords}
      />
      <NearbySheltersWithinRadius
        shelterId={shelter.id}
        limit={5}
        coords={coords}
      />
    </>
  );
}
