import type { FaqItem } from "@/lib/faq";

/**
 * Facility counts used by FAQ generators.
 * Defined locally until fakta-db.ts is available, then refactor to import.
 */
export interface FacilityCounts {
  toilet: number;
  water: number;
  baalplads: number;
  hund: number;
  strand: number;
  bruser: number;
  bookbar: number;
  gratis: number;
}

const FILTER_LABELS: Record<string, string> = {
  toilet: "toilet",
  vand: "vand",
  baalplads: "b\u00e5lplads",
  hund: "hund",
  strand: "strand",
  bruser: "bruser",
  booking: "booking",
};

const FILTER_LABELS_LONG: Record<string, string> = {
  toilet: "shelters med toilet",
  vand: "shelters med vand",
  baalplads: "shelters med b\u00e5lplads",
  hund: "hundevenlige shelters",
  strand: "shelters n\u00e6r strand",
  bruser: "shelters med bruser",
  booking: "bookbare shelters",
};

interface FilterPageFaqData {
  totalCount: number;
  topRegion: string;
  topRegionCount: number;
  avgRating: number | null;
  freeCount: number;
  bookableCount: number;
}

export function generateFilterPageFaq(filterKey: string, data: FilterPageFaqData): FaqItem[] {
  const label = FILTER_LABELS[filterKey] ?? filterKey;
  const labelLong = FILTER_LABELS_LONG[filterKey] ?? `shelters med ${label}`;
  return [
    {
      question: `Hvor mange shelters med ${label} er der i Danmark?`,
      answer: `Der er ${data.totalCount} ${labelLong} registreret i Danmark p\u00e5 ShelterDK.`,
    },
    {
      question: `Hvilken region har flest shelters med ${label}?`,
      answer: `${data.topRegion} har flest med ${data.topRegionCount} ${labelLong}.`,
    },
    // "Er shelters med X gratis?" FAQ er fjernet bevidst \u2014 payment-data
    // er for up\u00e5lideligt til at vises som tal.
    {
      question: `Kan man booke shelter med ${label}?`,
      answer: `Ja, ${data.bookableCount} ${labelLong} kan bookes p\u00e5 forh\u00e5nd via udinaturen.dk eller Naturstyrelsen.`,
    },
    {
      question: `Hvad er den gennemsnitlige bed\u00f8mmelse for shelters med ${label}?`,
      answer: data.avgRating
        ? `Den gennemsnitlige Google-bed\u00f8mmelse for ${labelLong} er ${data.avgRating} ud af 5.`
        : `Vi har endnu ikke nok anmeldelser til at beregne en gennemsnitlig bed\u00f8mmelse for ${labelLong}.`,
    },
  ];
}

interface RegionPageFaqData {
  totalCount: number;
  freeCount: number;
  facilityCounts: FacilityCounts;
  avgRating: number | null;
  topShelterName: string | null;
}

export function generateRegionPageFaq(
  regionName: string,
  preposition: string,
  data: RegionPageFaqData
): FaqItem[] {
  const inRegion = `${preposition} ${regionName}`;
  return [
    {
      question: `Hvor mange shelters er der ${inRegion}?`,
      answer: `Der er ${data.totalCount} shelters ${inRegion} registreret p\u00e5 ShelterDK.`,
    },
    {
      question: `Har shelters ${inRegion} toilet?`,
      answer: `${data.facilityCounts.toilet} shelters ${inRegion} har toilet (vandskyllende eller muldtoilet).`,
    },
    {
      question: `Kan man have hund med i shelter ${inRegion}?`,
      answer: `${data.facilityCounts.hund} shelters ${inRegion} tillader hund.`,
    },
    // "Er der gratis shelters?" FAQ er fjernet bevidst \u2014 payment-data
    // er for up\u00e5lideligt til at vises som tal.
    {
      question: `Hvad er den bedst bed\u00f8mte shelter ${inRegion}?`,
      answer: data.topShelterName
        ? `${data.topShelterName} er blandt de h\u00f8jest bed\u00f8mte shelters ${inRegion} baseret p\u00e5 Google-anmeldelser.`
        : `Se listen over shelters ${inRegion} sorteret efter bed\u00f8mmelse for at finde de bedste.`,
    },
  ];
}

interface MunicipalityPageFaqData {
  totalCount: number;
  freeCount: number;
  toiletCount: number;
  waterCount: number;
}

export function generateMunicipalityPageFaq(
  municipalityName: string,
  data: MunicipalityPageFaqData
): FaqItem[] {
  return [
    {
      question: `Hvor mange shelters er der i ${municipalityName}?`,
      answer: `Der er ${data.totalCount} shelters i ${municipalityName} registreret på ShelterDK.`,
    },
    {
      question: `Hvilke faciliteter har shelters i ${municipalityName}?`,
      answer: `${data.toiletCount} shelters har toilet og ${data.waterCount} har vand i ${municipalityName}.`,
    },
    // "Er der gratis shelters?" FAQ er fjernet bevidst — payment-data
    // er for upålideligt til at vises som tal.
  ];
}

interface PlacePageFaqData {
  totalCount: number;
  freeCount: number;
  toiletCount: number;
  waterCount: number;
  bookableCount: number;
}

export function generatePlacePageFaq(
  placeName: string,
  data: PlacePageFaqData
): FaqItem[] {
  return [
    {
      question: `Hvor finder jeg shelter i ${placeName}?`,
      answer: `På ShelterDK kan du se ${data.totalCount} shelter${data.totalCount !== 1 ? "s" : ""} i ${placeName} med kort, billeder, faciliteter og praktisk info.`,
    },
    {
      question: `Hvor mange shelters er der i ${placeName}?`,
      answer: `Der er ${data.totalCount} shelter${data.totalCount !== 1 ? "s" : ""} i ${placeName} registreret på ShelterDK.`,
    },
    {
      question: `Kan man booke shelter i ${placeName}?`,
      answer: data.bookableCount > 0
        ? `Ja, ${data.bookableCount} shelter${data.bookableCount !== 1 ? "s" : ""} i ${placeName} kan bookes på forhånd.`
        : `De fleste shelters i ${placeName} fungerer efter først-til-mølle-princippet, så tjek altid den enkelte plads før du tager afsted.`,
    },
    {
      question: `Har shelters i ${placeName} toilet eller vand?`,
      answer: `${data.toiletCount} shelters har toilet og ${data.waterCount} har adgang til vand i ${placeName}.`,
    },
    // "Er der gratis shelters?" FAQ er fjernet bevidst — payment-data er
    // for upålideligt. Bring tilbage når data er bedre.
  ];
}

interface CrossPageFaqData {
  count: number;
  avgRating: number | null;
  freeCount: number;
  topShelterName: string | null;
}

export function generateCrossPageFaq(
  filterKey: string,
  regionName: string,
  preposition: string,
  data: CrossPageFaqData
): FaqItem[] {
  const label = FILTER_LABELS[filterKey] ?? filterKey;
  const labelLong = FILTER_LABELS_LONG[filterKey] ?? `shelters med ${label}`;
  const inRegion = `${preposition} ${regionName}`;
  return [
    {
      question: `Hvor mange ${labelLong} er der ${inRegion}?`,
      answer: `Der er ${data.count} ${labelLong} ${inRegion} registreret p\u00e5 ShelterDK.`,
    },
    // "Er X gratis?" FAQ er fjernet bevidst \u2014 payment-data
    // er for up\u00e5lideligt til at vises som tal.
    {
      question: `Hvad er den bedst bed\u00f8mte shelter med ${label} ${inRegion}?`,
      answer: data.topShelterName
        ? `${data.topShelterName} er blandt de h\u00f8jest bed\u00f8mte ${labelLong} ${inRegion}.`
        : `Se listen over ${labelLong} ${inRegion} sorteret efter bed\u00f8mmelse.`,
    },
    {
      question: `Kan man booke shelter med ${label} ${inRegion}?`,
      answer: `Nogle ${labelLong} ${inRegion} kan bookes via udinaturen.dk eller Naturstyrelsen. Se de enkelte shelterbeskrivelser for bookingmuligheder.`,
    },
  ];
}
