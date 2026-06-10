interface SpeakableSchemaProps {
  url: string;
  selectors: string[];
  /** ISO-dato → WebPage.datePublished (freshness-signal). */
  datePublished?: string | null;
  /** ISO-dato → WebPage.dateModified (fx last_reviewed_at). */
  dateModified?: string | null;
  /** Synlig byline → WebPage.author (E-E-A-T). */
  authorName?: string | null;
}

export function SpeakableSchema({
  url,
  selectors,
  datePublished,
  dateModified,
  authorName,
}: SpeakableSchemaProps) {
  if (selectors.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    inLanguage: "da",
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(authorName
      ? { author: { "@type": "Organization", name: authorName } }
      : {}),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: selectors,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
