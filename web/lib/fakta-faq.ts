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
    {
      question: `Er shelters med ${label} gratis?`,
      answer: `${data.freeCount} ud af ${data.totalCount} ${labelLong} er gratis (f\u00f8rst-til-m\u00f8lle). De resterende kan have et mindre gebyr eller kr\u00e6ve booking.`,
    },
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
    {
      question: `Er der gratis shelters ${inRegion}?`,
      answer: `Ja, ${data.freeCount} ud af ${data.totalCount} shelters ${inRegion} er gratis (f\u00f8rst-til-m\u00f8lle).`,
    },
    {
      question: `Hvad er den bedst bed\u00f8mte shelter ${inRegion}?`,
      answer: data.topShelterName
        ? `${data.topShelterName} er blandt de h\u00f8jest bed\u00f8mte shelters ${inRegion} baseret p\u00e5 Google-anmeldelser.`
        : `Se listen over shelters ${inRegion} sorteret efter bed\u00f8mmelse for at finde de bedste.`,
    },
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
    {
      question: `Er ${labelLong} ${inRegion} gratis?`,
      answer: `${data.freeCount} ud af ${data.count} ${labelLong} ${inRegion} er gratis.`,
    },
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
