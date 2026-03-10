const BASE_URL = "https://shelterdk.dk";

/** JSON-LD WebSite schema for homepage – helps Google understand site structure. */
export function WebSiteSchema() {
  const website = {
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

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShelterDK",
    url: BASE_URL,
    logo: `${BASE_URL}/icon-96.png`,
    description:
      "ShelterDK hjælper dig med at finde shelters og overnatningspladser i hele Danmark.",
    sameAs: [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
