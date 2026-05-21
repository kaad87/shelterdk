interface HowToStep {
  name: string;
  text: string;
}

interface GuideHowToDefinition {
  name: string;
  description: string;
  totalTime?: string;
  supply?: string[];
  tool?: string[];
  step: HowToStep[];
}

const GUIDE_HOWTO_DEFINITIONS: Record<string, GuideHowToDefinition> = {
  "saadan-booker-du-shelter": {
    name: "Sådan booker du et shelter i Danmark",
    description:
      "En trin-for-trin-guide til at booke shelter via Ud i Naturen og lignende bookingsystemer.",
    totalTime: "PT10M",
    tool: ["Telefon eller computer med internet"],
    step: [
      {
        name: "Opret bruger",
        text: "Gå til udinaturen.dk og opret en gratis bruger",
      },
      {
        name: "Søg efter plads",
        text: "Søg på shelternavn, region eller vandrerute",
      },
      {
        name: "Tjek ledighed",
        text: "Vælg plads og tjek ledighed på den ønskede dato",
      },
      {
        name: "Book pladsen",
        text: 'Klik "Book" og udfyld antal personer og eventuel betaling',
      },
      {
        name: "Gem bekræftelsen",
        text: "Du modtager en bekræftelse på e-mail – gem den, da du kan blive bedt om at vise den",
      },
    ],
  },
};

export function getGuideHowToSchema(slug: string, url: string) {
  const definition = GUIDE_HOWTO_DEFINITIONS[slug];
  if (!definition) return null;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    inLanguage: "da",
    name: definition.name,
    description: definition.description,
    url,
    ...(definition.totalTime ? { totalTime: definition.totalTime } : {}),
    ...(definition.supply
      ? {
          supply: definition.supply.map((name) => ({
            "@type": "HowToSupply",
            name,
          })),
        }
      : {}),
    ...(definition.tool
      ? {
          tool: definition.tool.map((name) => ({
            "@type": "HowToTool",
            name,
          })),
        }
      : {}),
    step: definition.step.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}
