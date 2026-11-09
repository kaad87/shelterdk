import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getReviews,
  getRegionKommunePairs,
  getMunicipalitiesInRegion,
  getSheltersForStaticParams,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { resolveShelterSilo } from "@/lib/shelter-silo-resolve.server";
import { canonicalRegionSlug } from "@/lib/cross-page-config";
import { canonicalMunicipalityHref } from "@/lib/municipality-by-redirects";
import { getPublishedGuestReviews } from "@/lib/guest-reviews";
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
import { readOnsitePrice } from "@/lib/onsite-price";
import { ShelterDetailContent } from "@/components/ShelterDetailContent";
import { ShelterSchema } from "@/components/seo/ShelterSchema";
import { getRoutesForShelter } from "@/lib/shelter-routes";
import { getGearSuggestions } from "@/lib/gear-suggestions";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import {
  NearbySheltersWithinRadius,
  NearbySheltersSkeleton,
} from "@/components/NearbySheltersWithinRadius";
import { NearbyStays } from "@/components/naturophold/NearbyStays";
import { listBookableSheltersByShelterDbId } from "@/lib/booking-db";

interface PageProps {
  params: Promise<{ region: string; municipality: string; shelter_slug: string }>;
}

// false = en slug der ikke er i generateStaticParams svarer 404 UDEN at blive
// renderet, og Next udleverer den færdigbyggede app/not-found.tsx med krop og
// alt — præcis som kommuneruten. Det er den eneste variant der giver både
// rigtig statuskode og synligt indhold her. Målt mod next build + next start:
//
//   dynamicParams = true,  notFound() i render-træet       -> 200 + tom skal
//   dynamicParams = true,  notFound() i generateMetadata   -> 404 + tom krop
//   dynamicParams = false, not-found.tsx i segmentet       -> 404 + tom krop
//   dynamicParams = false, ingen not-found.tsx             -> 404 + krop  <- denne
//
// Hvorfor en not-found.tsx i SEGMENTET tømmer kroppen igen: med sin egen
// not-found-grænse skal Next rendere 404-siden on-demand i stedet for at sende
// den prerendrede, og i static-generation-tilstand havner indholdet kun i
// RSC-payloaden (klient-renderet, nul <h1> i HTML'en). Læg derfor ikke en
// not-found.tsx her — der er en test der vogter på det.
//
// Redirects kan af samme grund ikke komme fra siden. De 130 dublet-URL'er ligger
// som eksakte paths i next.config.js.
//
// PRISEN: et nyimporteret shelter svarer 404 indtil næste deploy. Kør derfor et
// deploy efter import_new_shelters_only.py — static params og sitemappet dækker
// samme 1.700 shelters (verificeret), så der er ingen levende URL udenfor.
export const dynamicParams = false;

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug, municipality: municipalitySlug, shelter_slug } = await params;
  const resolution = await resolveShelterSilo(regionSlug, municipalitySlug, shelter_slug);
  // HVORFOR 404/308 LIGGER I generateMetadata OG IKKE KUN I render:
  // ruten er statisk (●) med dynamicParams = true, så en ukendt slug renderes
  // on-demand i static-generation-tilstand. Dér er der ingen response at sætte
  // status på, så et notFound()/redirect() fra render-træet bliver bagt ind i
  // HTML'en (errored suspense boundary / <meta http-equiv="refresh">) og
  // udleveret med 200 — en soft-404 Netlify holdt i 24 timer.
  // generateMetadata kører FØR render-streamen, så throwet herfra kan stadig
  // bestemme statuskoden. Målt: uden dette var svaret 200 uanset om kaldet stod
  // i page.tsx eller i et layout.tsx uden for enhver Suspense-grænse.
  // Samme familie som kommunesidernes soft-404 (ab19c61).
  // Alt andet end "found" er 404 HERFRA. Redirectene (dublet-slugs) ligger i
  // next.config.js, fordi et permanentRedirect() fra denne statiske rute maalt
  // giver en 308 UDEN Location-header — ubrugelig. Er redirect-listen bagud,
  // er et aerligt 404 det rigtige fald-tilbage.
  if (resolution.kind !== "found") notFound();
  const { shelter } = resolution;

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

  // Statuskoden er allerede afgjort i generateMetadata (se hvorfor dér).
  // Kaldene her er nødvendige for KROPPEN: kommer throwet kun fra metadata-
  // passet, har render-træet intet at vise, og 404-siden bliver tom. Herfra
  // rammer notFound() app/not-found.tsx som den skal. Resultatet er
  // cache()-delt, så det er samme opslag — ikke et nyt Supabase-kald.
  const resolution = await resolveShelterSilo(regionSlug, municipalitySlug, shelter_slug);
  if (resolution.kind !== "found") notFound();
  const { shelter, region: shelterRegion, kommune: shelterKommune } = resolution;

  const pairs = await getRegionKommunePairs();
  const regions = [...new Set(pairs.map((p) => p.region))];
  const regionName = segmentSlugToName(regionSlug, regions);

  // Forkert region/kommune i pathen håndteres som 308 i layout.tsx (se dér
  // hvorfor det ikke kan ske herfra).

  const areaSlug = (shelter as { area_slug?: string | null }).area_slug?.trim() || null;
  const [municipalitiesResult, reviews, area, bookableShelters, guestReviews, gearSuggestions] = await Promise.all([
    regionName ? getMunicipalitiesInRegion(regionName) : Promise.resolve([]),
    getReviews(shelter.google_place_id ?? null),
    areaSlug ? getAreaBySlug(areaSlug) : Promise.resolve(null),
    listBookableSheltersByShelterDbId(shelter.id).catch(() => []),
    getPublishedGuestReviews(shelter.id).catch(() => []),
    getGearSuggestions(shelter).catch(() => []),
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
    // Region-HUBBEN bor på den korte kanoniske slug (fx /danmark/sjaelland),
    // mens kommuner/shelters bor på den lange (sjaelland-og-oeerne). Uden
    // canonicalRegionSlug her gik hvert eneste breadcrumb-link gennem en
    // 308-redirect, og hubben fik næsten ingen direkte interne links.
    { label: displayRegionName, href: `/danmark/${canonicalRegionSlug(displayRegionName)}` },
    // Kommuner hvis kommuneside 308'er til /by/<kommune> linkes direkte til
    // by-siden, saa breadcrumbet (og BreadcrumbList-JSON-LD'en) ikke peger paa
    // en redirect og by-siden faar de interne links.
    {
      label: displayMunicipalityName,
      href: canonicalMunicipalityHref(`/danmark/${regionSlug}/${municipalitySlug}`),
    },
    { label: shelter.title },
  ];

  const breadcrumbSchemaItems: { label: string; href?: string }[] = breadcrumbs.map((b) =>
    b.href ? { label: b.label, href: b.href } : { label: b.label }
  );
  const canonicalPath = `/danmark/${regionSlug}/${municipalitySlug}/${shelter_slug}`;

  // Ærligt pris-offer (schema.org Offer) for ShelterDK-bookbare enheder — laveste
  // 1-nats-total (shelterpris + minimumsgebyr) fra vores egne booking-data.
  const bookingOffer =
    bookableShelters.length > 0
      ? {
          priceDkk: Math.min(
            ...bookableShelters.map(
              (u) => (u.shelter_price_dkk ?? 0) + (u.platform_fee_min_dkk ?? 0)
            )
          ),
          url: `https://shelterdk.dk${canonicalPath}`,
        }
      : null;

  return (
    <>
      <ShelterSchema shelter={shelter} canonicalPath={canonicalPath} reviews={reviews} guestReviews={guestReviews} bookingOffer={bookingOffer} />
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
        priceDkk: unit.shelter_price_dkk ?? null,
        feeMinDkk: unit.platform_fee_min_dkk ?? null,
        // Ejerens egen pris (fx MobilePay). Vises, men opkræves aldrig af os.
        onsitePrice: readOnsitePrice(unit),
      }))}
      bookingFallbackHint={bookingFallbackHint}
      firewood={getFirewood(shelter)}
      facilityLinks={facilityLinks}
      nearbyRoutes={getRoutesForShelter(shelter_slug)}
      gearSuggestions={gearSuggestions}
      isBookable={bookingModel.requiresBooking}
      shelterFaqItems={shelterFaqItems}
      shelterFaqJsonLd={shelterFaqJsonLd}
      reviews={reviews}
      guestReviews={guestReviews}
      coords={coords}
      weatherForecast={weatherForecast}
      nearbySlot={
        /* Renderes INDE i detaljesiden (lige efter svaret), ikke efter den.
           Datahentningen bliver her, hvor coords findes; placeringen bestemmes
           af ShelterDetailContent. */
        <Suspense fallback={<NearbySheltersSkeleton count={5} />}>
          <NearbySheltersWithinRadius
            shelterId={shelter.id}
            limit={5}
            coords={coords}
          />
        </Suspense>
      }
      />
      <Suspense fallback={null}>
        <NearbyStays coords={coords ? { lat: coords.lat, lon: coords.lon } : null} />
      </Suspense>
    </>
  );
}
