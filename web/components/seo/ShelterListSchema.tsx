/**
 * JSON-LD ItemList schema for region and municipality pages.
 * Helps Google understand the page is a curated list of places.
 */

const BASE_URL = "https://shelterdk.dk";
const MAX_ITEMS = 30;

interface ShelterListSchemaProps {
  name: string;
  shelters: Array<{ id: number | string; slug: string }>;
  /** Full href path for each shelter, e.g. "/danmark/jylland/aarhus/slug" */
  hrefFn: (shelter: { id: number | string; slug: string }) => string;
}

export function ShelterListSchema({ name, shelters, hrefFn }: ShelterListSchemaProps) {
  if (!shelters.length) return null;

  const items = shelters.slice(0, MAX_ITEMS);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: shelters.length,
    itemListElement: items.map((shelter, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}${hrefFn(shelter)}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
