export interface FilterConfig {
  filterKey: string;
  filterLabel: string;
  filterLabelLong: string;
  parentHref: string;
  minSheltersForRegion: number;
  relatedBlogLinks: { label: string; href: string }[];
}

export const FILTER_CONFIGS: Record<string, FilterConfig> = {
  toilet: {
    filterKey: "toilet",
    filterLabel: "toilet",
    filterLabelLong: "Shelters med toilet",
    parentHref: "/shelter-med-toilet",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
    ],
  },
  vand: {
    filterKey: "vand",
    filterLabel: "vand",
    filterLabelLong: "Shelters med vand",
    parentHref: "/shelter-med-vand",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
    ],
  },
  baalplads: {
    filterKey: "baalplads",
    filterLabel: "bålplads",
    filterLabelLong: "Shelters med bålplads",
    parentHref: "/shelter-med-baalplads",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  hund: {
    filterKey: "hund",
    filterLabel: "hund",
    filterLabelLong: "Hundevenlige shelters",
    parentHref: "/shelter-med-hund",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
    ],
  },
  strand: {
    filterKey: "strand",
    filterLabel: "strand",
    filterLabelLong: "Shelters nær strand",
    parentHref: "/shelter-med-strand",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  bruser: {
    filterKey: "bruser",
    filterLabel: "bruser",
    filterLabelLong: "Shelters med bruser",
    parentHref: "/shelter-med-bruser",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
      { label: "Sådan vælger du det perfekte shelter", href: "/guides/saadan-finder-du-det-perfekte-shelter" },
    ],
  },
  booking: {
    filterKey: "booking",
    filterLabel: "booking",
    filterLabelLong: "Bookbare shelters",
    parentHref: "/shelter-booking",
    minSheltersForRegion: 5,
    relatedBlogLinks: [
      { label: "Gratis shelters guide", href: "/blog/gratis-shelters-i-danmark" },
    ],
  },
  handicap: {
    filterKey: "handicap",
    filterLabel: "handicap",
    filterLabelLong: "Handicapvenlige shelters",
    parentHref: "/handicapvenlige-shelters",
    minSheltersForRegion: 3,
    relatedBlogLinks: [
      { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
      { label: "Sådan vælger du shelter", href: "/guides/saadan-finder-du-det-perfekte-shelter" },
    ],
  },
};

export const REGION_SLUGS = ["jylland", "sjaelland", "fyn", "bornholm"] as const;

/** DB-værdier for region-kolonnen. Skal matche hvad der faktisk ligger i Supabase. */
export const REGION_NAMES: Record<string, string> = {
  jylland: "Jylland",
  sjaelland: "Sjælland og Øerne",
  fyn: "Fyn",
  bornholm: "Bornholm",
};

/** Kortere visningsnavne til brug i UI-tekst (pills, inline breakdowns). */
export const REGION_SHORT_NAMES: Record<string, string> = {
  jylland: "Jylland",
  sjaelland: "Sjælland",
  fyn: "Fyn",
  bornholm: "Bornholm",
};

export function getOtherRegionLinks(
  filterConfig: FilterConfig,
  currentRegionSlug: string,
  validRegionSlugs: string[]
): { name: string; href: string }[] {
  return validRegionSlugs
    .filter((slug) => slug !== currentRegionSlug)
    .map((slug) => ({
      name: REGION_NAMES[slug] ?? slug,
      href: `${filterConfig.parentHref}/${slug}`,
    }));
}

export function getOtherFilterLinks(
  currentFilterKey: string,
  regionSlug: string
): { label: string; href: string }[] {
  return Object.values(FILTER_CONFIGS)
    .filter((c) => c.filterKey !== currentFilterKey)
    .map((c) => ({
      label: c.filterLabelLong,
      href: `${c.parentHref}/${regionSlug}`,
    }));
}
