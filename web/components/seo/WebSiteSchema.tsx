const BASE_URL = "https://shelterdk.dk";

/** JSON-LD WebSite schema for homepage – helps Google understand site structure. */
export function WebSiteSchema() {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ShelterDK",
    url: BASE_URL,
    inLanguage: "da",
    description:
      "Find og udforsk shelters i hele Danmark. Se billeder, anmeldelser og praktisk info for overnatning i naturen.",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShelterDK",
    url: BASE_URL,
    inLanguage: "da",
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
