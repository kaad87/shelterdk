/**
 * FAQ data and helpers for SEO-friendly Q&A.
 * The Q&A format is how Perplexity and ChatGPT parse information for answers.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

/** Global site FAQs for /faq page – natural-language questions users and crawlers search for. */
export const GLOBAL_FAQS: FaqItem[] = [
  {
    question: "Hvad er et shelter i Danmark?",
    answer:
      "Et shelter er en offentlig overnatningsplads i naturen, typisk med tag, bænke og ofte en bålplads. Shelters findes i skove, ved kyster og på vandreruter. De er ofte gratis eller billige og kan være først-til-mølle eller bookbare.",
  },
  {
    question: "Hvor finder jeg shelters i Danmark?",
    answer:
      "ShelterDK samler shelters fra hele Danmark på ét kort. Du kan søge efter region, by eller område og filtrere på fx bookbare shelters eller dem med billeder og anmeldelser. Data kommer fra GeoFA, Naturstyrelsen, udinaturen.dk og Book en Shelter.",
  },
  {
    question: "Er shelters i Danmark gratis?",
    answer:
      "Mange shelters er gratis at bruge (først-til-mølle). Nogle kræver booking og kan have en mindre gebyr – især på Naturstyrelsens og andre forvaltede arealer. På hver shelterside står der om det er gratis eller betaling, og om der findes et bookinglink.",
  },
  {
    question: "Kan man booke et shelter i Danmark?",
    answer:
      "Ja. En del shelters kan bookes på forhånd via udinaturen.dk, book.naturstyrelsen.dk eller Book en Shelter. På ShelterDK kan du filtrere søgningen på «Bookbar» for kun at se shelters med bookingmulighed. Bookbare shelters er særligt anbefalet i højsæsonen.",
  },
  {
    question: "Er der toilet på shelterpladser i Danmark?",
    answer:
      "Det varierer. Nogle pladser har vandskyllende toilet, andre muldtoilet eller tørklosetter, og nogle har slet ikke toilet – så skal man medbringe spade eller bruge nærliggende offentlige toiletter. Se vores liste over shelters med toilet for at finde pladser med denne facilitet. På hver shelterside angives toilettype når data findes.",
  },
  {
    question: "Må man have hund med til shelter?",
    answer:
      "Reglerne varierer fra sted til sted. Nogle shelter tillader hunde, andre ikke. Tjek beskrivelsen på den enkelte shelter på ShelterDK, eller kontakt ejer/forvalter (Naturstyrelsen, kommunen osv.) for at være sikker.",
  },
  {
    question: "Hvad betyder først-til-mølle shelter?",
    answer:
      "Først-til-mølle betyder at pladsen ikke kan bookes. Den der kommer først, har ret til at overnatte. Det er derfor en god idé at have et plan B eller ankomme tidligt i højsæsonen.",
  },
  {
    question: "Hvor mange shelter er der i Danmark?",
    answer:
      "Der findes over 1000 shelters i Danmark registreret i offentlige og frivillige datakilder. ShelterDK viser dem på ét kort med mulighed for at søge efter region, by og faciliteter.",
  },
  {
    question: "Hvad skal man medbringe til shelterovernatning?",
    answer:
      "Typisk sovepose, mad og drikke, evt. telt eller regnbeskyttelse da sheltertag ikke altid dækker fuldt. Mange steder har bålplads – tjek om brænde må bruges eller medbringes. Tag altid affald med og efterlad pladsen ren.",
  },
  {
    question: "Er shelter egnet til vinter?",
    answer:
      "Mange shelters er åbne året rundt, men sæson og vejr står ofte på sheltersiden. I vinterhalvåret er det vigtigt med varm sovepose og evt. ekstra isolation. Nogle shelters har kun åben i sæsonen – tjek «Sæson» under faciliteter.",
  },
  {
    question: "Hvem ejer shelters i Danmark?",
    answer:
      "Shelters ejes eller forvaltes af Naturstyrelsen, kommuner, private grundejere eller foreninger. På ShelterDK angives ejer/forvalter på den enkelte shelterside når oplysningerne findes i kildedata.",
  },
  {
    question: "Hvad er forskellen på shelter og bålplads?",
    answer:
      "Et shelter har typisk tag og ofte bænke så man kan overnatte under dække. En bålplads er ofte kun en anvist bålplads uden fast shelter – du skal sove i telt eller under tarp. ShelterDK fokuserer på overnatningspladser med shelter.",
  },
  {
    question: "Kan man cykle til shelter i Danmark?",
    answer:
      "Ja. Mange shelters ligger tæt på cykelstier eller veje med god adgang. Brug kortet og beskrivelsen på ShelterDK til at vurdere afstand og underlag. Tilgængelighed (parkering, belægning) står ofte under «Tilgængelighed» på sheltersiden.",
  },
  {
    question: "Hvordan rapporterer jeg fejl på ShelterDK?",
    answer:
      "Du kan bruge kontaktlinket i menuen eller footeren. Angiv gerne shelterside og hvad der er galt (fx forkert adresse, lukket plads eller manglende bookinglink), så kan vi rette det.",
  },
];

/**
 * Build shelter-specific FAQ items for a given shelter.
 * These match the Q&A format that Perplexity/ChatGPT use to answer user questions.
 */
export function getShelterFaqItems(
  shelterTitle: string,
  options: {
    toilet: "flush" | "mulch" | "none" | "unknown" | null;
    bookable: boolean;
    bookingUrl: string | null;
    petsAllowed: boolean | null;
  }
): FaqItem[] {
  const title = shelterTitle;
  const items: FaqItem[] = [];

  // Toilet
  const toiletLabels: Record<string, string> = {
    flush: "vandskyllende toilet",
    mulch: "muldtoilet / tørkloset",
    none: "Ingen toilet på pladsen – medbring spade eller brug nærliggende toiletter.",
    unknown: "Vi har ikke oplysninger om toilet på denne plads. Tjek beskrivelsen eller kontakt forvalter.",
  };
  const toiletAnswer =
    options.toilet === "none"
      ? toiletLabels.none
      : options.toilet === "unknown"
        ? toiletLabels.unknown
        : options.toilet
          ? `Ja, der findes et ${toiletLabels[options.toilet]} på pladsen.`
          : toiletLabels.unknown;
  items.push({
    question: `Er der toilet på ${title}?`,
    answer: toiletAnswer,
  });

  // Booking
  if (options.bookable && options.bookingUrl) {
    items.push({
      question: `Kan man booke ${title}?`,
      answer: `Ja, ${title} kan bookes. Du kan reservere pladsen via linket på denne side (booking sker hos udinaturen.dk, Naturstyrelsen eller andre forvaltere).`,
    });
  } else if (options.bookable) {
    items.push({
      question: `Kan man booke ${title}?`,
      answer: `Ja, shelteret angives som bookbart. Kontakt forvalteren eller tjek udinaturen.dk for aktuelle bookingmuligheder.`,
    });
  } else {
    items.push({
      question: `Kan man booke ${title}?`,
      answer: `${title} er et først-til-mølle shelter og kan ikke bookes. Pladsen er fri til brug for den der kommer først.`,
    });
  }

  // Pets
  let petsAnswer: string;
  if (options.petsAllowed === true) {
    petsAnswer = "Ja, man må have hund med på denne shelterplads.";
  } else if (options.petsAllowed === false) {
    petsAnswer = "Nej, hund er ikke tilladt på denne plads.";
  } else {
    petsAnswer =
      "Vi har ikke oplysninger om hvorvidt hund er tilladt. Tjek beskrivelsen eller kontakt ejer/forvalter før du tager hunden med.";
  }
  items.push({
    question: "Må man have hund med?",
    answer: petsAnswer,
  });

  return items;
}

/** JSON-LD FAQPage schema for a list of FAQ items. */
export function faqToJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
