import { BASE_URL, ORGANIZATION_ID } from "@/components/seo/organization";

/**
 * JSON-LD WebSite + Organization schema for the homepage.
 *
 * - WebSite: minimal declaration so Google can link entities together.
 *   We deliberately do NOT include a SearchAction:
 *     1. Google deprecated the Sitelinks Searchbox feature in Nov 2024,
 *        so the markup no longer renders in SERPs.
 *     2. Our search target (/soeg) is robots:noindex by design — sending
 *        Google an action that points at a noindex page is a contradictory
 *        signal even if technically allowed.
 * - Organization: brand entity declaration for knowledge-panel / logo-in-SERP
 *   eligibility. `sameAs` is intentionally absent — add the brand's actual
 *   social URLs (Instagram, Facebook, LinkedIn) when they exist.
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
    publisher: { "@id": ORGANIZATION_ID },
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
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
    // sameAs udelades med vilje indtil brandets egne profil-URL'er er kendte.
    // Et tomt array er et dårligere signal end ingen oplysning, og de
    // instagram_posts vi viser, er kuraterede opslag fra ANDRE konti — de kan
    // ikke bruges som sitets egne profiler. Udfyld når handles foreligger:
    //   sameAs: ["https://www.instagram.com/<handle>/", ...]
    //
    // Artikler, guides og forsiden peger nu alle på dette ene @id, så
    // entiteten står som ét objekt med logo, kontaktpunkt og areaServed.
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
