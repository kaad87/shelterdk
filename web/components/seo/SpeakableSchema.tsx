interface SpeakableSchemaProps {
  url: string;
  selectors: string[];
}

export function SpeakableSchema({ url, selectors }: SpeakableSchemaProps) {
  if (selectors.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    inLanguage: "da",
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
