const BASE_URL = "https://shelterdk.dk";

/** JSON-LD WebSite schema for homepage – helps Google understand site structure. */
export function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ShelterDK",
    url: BASE_URL,
    description:
      "Find og udforsk shelters i hele Danmark. Se billeder, anmeldelser og praktisk info for overnatning i naturen.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/soeg?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
