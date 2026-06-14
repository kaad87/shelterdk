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
  /**
   * ISO-dato for hvornår listens data sidst blev opdateret. Når den er sat,
   * wrappes ItemList i en CollectionPage med `dateModified` — et freshness-
   * signal til Google, der matcher sitemap'ets lastmod. Bagudkompatibel:
   * udelades den, emitteres som før en ren ItemList.
   */
  dateModified?: string;
  /** Kanonisk URL for siden (bruges på CollectionPage-wrapperen). */
  url?: string;
}

export function ShelterListSchema({ name, shelters, hrefFn, dateModified, url }: ShelterListSchemaProps) {
  if (!shelters.length) return null;

  const items = shelters.slice(0, MAX_ITEMS);

  const itemList = {
    "@type": "ItemList",
    name,
    numberOfItems: shelters.length,
    itemListElement: items.map((shelter, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}${hrefFn(shelter)}`,
    })),
  };

  const jsonLd = dateModified
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        ...(url ? { url } : {}),
        dateModified,
        mainEntity: itemList,
      }
    : { "@context": "https://schema.org", ...itemList };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
