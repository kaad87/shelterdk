/**
 * JSON-LD TouristDestination + Place schema for /by/[by_slug] city pages.
 *
 * Tells Google that the by-page represents a real destination (a Danish
 * city) and that it contains a set of Campground entities (shelters).
 * This is the structured-data complement to the in-page editorial — it
 * gives Google a machine-readable entity graph for the city + its
 * outdoor amenities.
 *
 * Why TouristDestination and not just Place? TouristDestination is a
 * subclass of Place with semantics tailored to travel/outdoor search,
 * which matches the actual intent behind "shelter [city]" queries.
 */

const BASE_URL = "https://shelterdk.dk";
const MAX_CONTAINED_PLACES = 15;

interface CityDestinationSchemaProps {
  placeName: string;
  citySlug: string;
  shelters: Array<{
    id: number | string;
    title: string;
    slug: string;
    region?: string | null;
    kommune?: string | null;
  }>;
  /** Full href path for each shelter, e.g. "/danmark/jylland/aarhus/slug" */
  hrefFn: (shelter: { id: number | string; slug: string }) => string;
  /** Optional editorial summary for the destination description. */
  description?: string;
}

export function CityDestinationSchema({
  placeName,
  citySlug,
  shelters,
  hrefFn,
  description,
}: CityDestinationSchemaProps) {
  if (!shelters.length) return null;

  const containedPlaces = shelters.slice(0, MAX_CONTAINED_PLACES).map((shelter) => ({
    "@type": "Campground" as const,
    name: shelter.title,
    url: `${BASE_URL}${hrefFn(shelter)}`,
    ...(shelter.kommune
      ? {
          address: {
            "@type": "PostalAddress" as const,
            addressLocality: shelter.kommune,
            addressCountry: "DK",
          },
        }
      : {}),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    "@id": `${BASE_URL}/by/${citySlug}#destination`,
    name: `Shelter i ${placeName}`,
    url: `${BASE_URL}/by/${citySlug}`,
    ...(description ? { description } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: placeName,
      addressCountry: "DK",
    },
    includesAttraction: containedPlaces,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
