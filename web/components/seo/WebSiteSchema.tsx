const BASE_URL = "https://shelterdk.dk";

/**
 * JSON-LD WebSite + Organization schema for the homepage.
 *
 * - WebSite: with SearchAction so Google can render the in-SERP search box
 *   (sitelinks searchbox feature).
 * - Organization: brand entity declaration for knowledge-panel / logo-in-SERP
 *   eligibility. `sameAs` is intentionally empty for now — add the brand's
 *   actual social URLs (Instagram, Facebook, LinkedIn) when they exist.
 */
export function WebSiteSchema() {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}#website`,
    name: "ShelterDK",
    url: BASE_URL,
    inLanguage: "da",
    description:
      "Find og udforsk shelters i hele Danmark. Se billeder, anmeldelser og praktisk info for overnatning i naturen.",
    publisher: { "@id": `${BASE_URL}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/soeg?q={search_term_string}`,
      },
      // schema.org requires this exact spelling — Google validates it.
      "query-input": "required name=search_term_string",
    },
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}#organization`,
    name: "ShelterDK",
    url: BASE_URL,
    inLanguage: "da",
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/icon-96.png`,
      width: 96,
      height: 96,
    },
    description:
      "ShelterDK hjælper dig med at finde shelters og overnatningspladser i hele Danmark.",
    areaServed: {
      "@type": "Country",
      name: "Danmark",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hej@shelterdk.dk",
      availableLanguage: ["da"],
    },
    // TODO: udfyld med brandets faktiske profiler — fx
    //   "https://www.instagram.com/<handle>/",
    //   "https://www.facebook.com/<handle>/",
    // Tomme arrays sender et signal til Google om at vi IKKE har sociale
    // profiler, så det er bedre helt at udelade feltet indtil URL'erne
    // er kendte. Sletter derfor sameAs frem for at lade det stå tomt.
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
