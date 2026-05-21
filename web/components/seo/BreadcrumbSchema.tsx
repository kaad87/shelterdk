interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
  baseUrl?: string;
}

const DEFAULT_BASE = "https://shelterdk.dk";

/** JSON-LD BreadcrumbList for Google rich results. */
export function BreadcrumbSchema({
  items,
  baseUrl = DEFAULT_BASE,
}: BreadcrumbSchemaProps) {
  const listItems = items
    .map((item, i) => {
      const url = item.href ? `${baseUrl}${item.href}` : undefined;
      return {
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        ...(url && { item: url }),
      };
    })
    .filter((x) => x.name);

  if (listItems.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: "da",
    itemListElement: listItems,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
