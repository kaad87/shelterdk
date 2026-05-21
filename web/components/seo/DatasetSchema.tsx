interface DatasetSchemaProps {
  name: string;
  description: string;
  url: string;
  dateModified?: string;
  spatialCoverage?: string;
  variableMeasured?: string[];
}

/**
 * schema.org/Dataset JSON-LD for data-authority pages.
 * Signals to AI bots that this page contains structured, citable data.
 */
export function DatasetSchema({
  name,
  description,
  url,
  dateModified,
  spatialCoverage = "Danmark",
  variableMeasured = [],
}: DatasetSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    inLanguage: "da",
    name,
    description,
    url,
    creator: {
      "@type": "Organization",
      name: "ShelterDK",
      url: "https://shelterdk.dk",
    },
    ...(dateModified && { dateModified }),
    spatialCoverage: {
      "@type": "Place",
      name: spatialCoverage,
    },
    ...(variableMeasured.length > 0 && { variableMeasured }),
    license: "https://creativecommons.org/licenses/by/4.0/",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
