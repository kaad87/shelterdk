import type { Shelter } from "@/types/shelter";
import {
  getLocationCoords,
  getToilet,
  getWater,
  getPhotoUrls,
  getLongDescription,
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
  /** Use CivicStructure for fully public/civic shelters; default CampingPitch. */
  useCivicStructure?: boolean;
  /** When available (e.g. from geofa_raw), include firewood in amenityFeature. */
  firewood?: boolean | null;
}

/**
 * Renders JSON-LD script tag for a shelter so Google knows name, description,
 * coordinates, amenities (toilet, water, firewood), images and address.
 */
export function ShelterSchema({
  shelter,
  canonicalPath = null,
  useCivicStructure = false,
  firewood = null,
}: ShelterSchemaProps) {
  const coords = getLocationCoords(shelter);
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const images = getPhotoUrls(shelter);

  const description =
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

  const addressParts: string[] = [];
  if (shelter.place?.trim()) addressParts.push(shelter.place.trim());
  if (shelter.kommune?.trim()) addressParts.push(shelter.kommune.trim());
  if (shelter.region?.trim() && shelter.region !== "Danmark")
    addressParts.push(shelter.region.trim());
  const address = addressParts.length > 0 ? addressParts.join(", ") : "Danmark";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": useCivicStructure ? "CivicStructure" : "CampingPitch",
    name,
    ...(canonicalPath && { url: `${BASE_URL}${canonicalPath}` }),
    ...(description && { description }),
    ...(coords && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: coords.lat,
        longitude: coords.lon,
      },
    }),
    ...(amenityFeatures.length > 0 && { amenityFeature: amenityFeatures }),
    ...(images.length > 0 && { image: images }),
    address: address,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
