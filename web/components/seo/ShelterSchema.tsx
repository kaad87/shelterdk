import type { Shelter } from "@/types/shelter";
import {
  getLocationCoords,
  getToilet,
  getWater,
  getPhotoUrls,
  getLongDescription,
  getAddress,
  getCity,
  getPayment,
  stripHtml,
} from "@/lib/shelter-detail";

interface LocationFeatureSpecification {
  "@type": "LocationFeatureSpecification";
  name: string;
  value: string | boolean;
}

const BASE_URL = "https://shelterdk.dk";

export interface ShelterSchemaReview {
  author_name: string | null;
  rating: number | null;
  text: string | null;
  relative_time_description: string | null;
  time: string | null;
}

interface AggregateRating {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
}

interface ShelterSchemaProps {
  shelter: Shelter;
  /** Canonical URL for this shelter (fx /danmark/region/kommune/slug). */
  canonicalPath?: string | null;
  /** Use LodgingBusiness; default Campground (schema.org subtype of LodgingBusiness). */
  useLodgingBusiness?: boolean;
  /** When available (e.g. from geofa_raw), include firewood in amenityFeature. */
  firewood?: boolean | null;
  /** Reserved for future first-party reviews; Google Places reviews are not marked up. */
  reviews?: ShelterSchemaReview[];
}

/**
 * Renders JSON-LD script tag for a shelter (Campground or LodgingBusiness).
 * Fulfills Google's structured data guidelines: name, description, geo, address, priceRange.
 */
export function ShelterSchema({
  shelter,
  canonicalPath = null,
  useLodgingBusiness = false,
  firewood = null,
  reviews: _reviews = [],
}: ShelterSchemaProps) {
  const coords = getLocationCoords(shelter);
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const images = getPhotoUrls(shelter);
  const streetAddress = getAddress(shelter);
  const locality = getCity(shelter) ?? shelter.kommune?.trim() ?? shelter.place?.trim() ?? null;
  const region = (shelter.region ?? "").trim();
  const payment = getPayment(shelter);

  const description =
    (shelter.seo_description?.trim() ? stripHtml(shelter.seo_description) : null) ||
    getLongDescription(shelter) ||
    (shelter.description ? stripHtml(shelter.description) : null) ||
    shelter.description ||
    null;
  const name = shelter.title?.trim() || "Shelter";
  const aggregateRating: AggregateRating | undefined =
    shelter.google_rating != null &&
    shelter.google_user_ratings_total != null &&
    shelter.google_user_ratings_total > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(shelter.google_rating.toFixed(1)),
          reviewCount: shelter.google_user_ratings_total,
        }
      : undefined;

  const amenityFeatures: LocationFeatureSpecification[] = [];

  if (toilet === "flush") {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Toilet",
      value: "Vandskyllende toilet",
    });
  } else if (toilet === "mulch") {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Toilet",
      value: "Muldtoilet (medbring papir)",
    });
  } else if (toilet === "none") {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Toilet",
      value: "Ingen toilet på pladsen",
    });
  }

  if (water === true) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Water",
      value: "Yes",
    });
  } else if (water === false) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Water",
      value: "No",
    });
  }

  if (firewood === true) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Firewood",
      value: "Yes",
    });
  } else if (firewood === false) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: "Firewood",
      value: "No",
    });
  }

  // schema.org PostalAddress for Google
  const addressObj: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: "DK",
  };
  if (streetAddress) addressObj.streetAddress = streetAddress;
  if (locality) addressObj.addressLocality = locality;
  if (region && region !== "Danmark") addressObj.addressRegion = region;

  // priceRange er fjernet bevidst — payment-data er for upålideligt til at
  // vise i strukturdata. Forkert priceRange="0" på betalbare shelters er
  // mere skadeligt end et manglende felt. Bring tilbage når data er bedre.
  const priceRange: string | undefined = undefined;
  void payment; // keep import & avoid unused-var lint until data fixed

  const containedInPlace: Record<string, unknown>[] = [];
  if (region && region !== "Danmark") {
    containedInPlace.push({
      "@type": "AdministrativeArea",
      name: region,
    });
  }
  if (locality) {
    containedInPlace.push({
      "@type": "AdministrativeArea",
      name: locality,
    });
  }

  const hasMap = canonicalPath ? `${BASE_URL}${canonicalPath}#kort` : undefined;

  const additionalProperties: Record<string, unknown>[] = [];
  const geofa = shelter.geofa_raw as Record<string, unknown> | null;
  if (geofa) {
    if (String(geofa.baalplads ?? "").toLowerCase().includes("ja")) {
      additionalProperties.push({ "@type": "PropertyValue", name: "Bålplads", value: "Ja" });
    }
    if (String(geofa.hunde_tilladt ?? "").toLowerCase().includes("ja")) {
      additionalProperties.push({ "@type": "PropertyValue", name: "Hund tilladt", value: "Ja" });
    }
    if (String(geofa.strand_naerhed ?? "").toLowerCase().includes("ja")) {
      additionalProperties.push({ "@type": "PropertyValue", name: "Nær strand", value: "Ja" });
    }
    if (String(geofa.bord_baenk ?? "").toLowerCase().includes("ja")) {
      additionalProperties.push({ "@type": "PropertyValue", name: "Bord/bænk", value: "Ja" });
    }
  }

  const numberOfRooms = useLodgingBusiness && shelter.capacity ? shelter.capacity : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": useLodgingBusiness ? "LodgingBusiness" : "Campground",
    inLanguage: "da",
    name,
    ...(shelter.created_at && { datePublished: shelter.created_at }),
    ...(shelter.updated_at && { dateModified: shelter.updated_at }),
    ...(description && { description }),
    ...(canonicalPath && { url: `${BASE_URL}${canonicalPath}` }),
    geo:
      coords ?
        {
          "@type": "GeoCoordinates",
          latitude: coords.lat,
          longitude: coords.lon,
        }
      : undefined,
    address: addressObj,
    ...(priceRange !== undefined && { priceRange }),
    ...(amenityFeatures.length > 0 && { amenityFeature: amenityFeatures }),
    ...(images.length > 0 && { image: images }),
    ...(aggregateRating && { aggregateRating }),
    ...(containedInPlace.length > 0 && { containedInPlace }),
    ...(hasMap && { hasMap }),
    ...(additionalProperties.length > 0 && { additionalProperty: additionalProperties }),
    ...(numberOfRooms && { numberOfRooms }),
  };

  // Remove undefined so JSON-LD is valid
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (v !== undefined && v !== null) cleaned[k] = v;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleaned) }}
    />
  );
}
