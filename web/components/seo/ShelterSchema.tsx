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

interface ShelterSchemaProps {
  shelter: Shelter;
  /** Canonical URL for this shelter (fx /danmark/region/kommune/slug). */
  canonicalPath?: string | null;
  /** Use LodgingBusiness; default Campground (schema.org subtype of LodgingBusiness). */
  useLodgingBusiness?: boolean;
  /** When available (e.g. from geofa_raw), include firewood in amenityFeature. */
  firewood?: boolean | null;
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
}: ShelterSchemaProps) {
  const coords = getLocationCoords(shelter);
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const images = getPhotoUrls(shelter);
  const streetAddress = getAddress(shelter);
  const locality = getCity(shelter) ?? shelter.kommune?.trim() ?? shelter.place?.trim() ?? null;
  const region = (shelter.region ?? "").trim();
  const payment = getPayment(shelter);
  const rating = shelter.google_rating;
  const ratingCount = shelter.google_user_ratings_total;

  const description =
    (shelter.seo_description?.trim() ? stripHtml(shelter.seo_description) : null) ||
    getLongDescription(shelter) ||
    (shelter.description ? stripHtml(shelter.description) : null) ||
    shelter.description ||
    null;
  const name = shelter.title?.trim() || "Shelter";

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

  // priceRange: "0" when free (Google-friendly)
  const isFree =
    !payment || (typeof payment === "string" && payment.toLowerCase().includes("nej"));
  const priceRange = isFree ? "0" : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": useLodgingBusiness ? "LodgingBusiness" : "Campground",
    name,
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
    ...(rating != null &&
      ratingCount != null &&
      ratingCount > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: rating,
          ratingCount,
        },
      }),
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
