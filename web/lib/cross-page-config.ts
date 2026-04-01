export interface FilterConfig {
  filterKey: string;
  filterLabel: string;
  filterLabelLong: string;
  parentHref: string;
  relatedBlogLinks: { label: string; href: string }[];
}

export const FILTER_CONFIGS: Record<string, FilterConfig> = {
  toilet: {
    filterKey: "toilet",
    filterLabel: "toilet",
    filterLabelLong: "Shelters med toilet",
    parentHref: "/shelter-med-toilet",
    relatedBlogLinks: [
      { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
    ],
  },
  vand: {
    filterKey: "vand",
    filterLabel: "vand",
    filterLabelLong: "Shelters med vand",
    parentHref: "/shelter-med-vand",
    relatedBlogLinks: [
      { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
    ],
  },
  baalplads: {
    filterKey: "baalplads",
    filterLabel: "bålplads",
    filterLabelLong: "Shelters med bålplads",
    parentHref: "/shelter-med-baalplads",
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  hund: {
    filterKey: "hund",
    filterLabel: "hund",
    filterLabelLong: "Hundevenlige shelters",
    parentHref: "/shelter-med-hund",
    relatedBlogLinks: [
      { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere" },
    ],
  },
  strand: {
    filterKey: "strand",
    filterLabel: "strand",
    filterLabelLong: "Shelters nær strand",
    parentHref: "/shelter-med-strand",
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  bruser: {
    filterKey: "bruser",
    filterLabel: "bruser",
    filterLabelLong: "Shelters med bruser",
    parentHref: "/shelter-med-bruser",
    relatedBlogLinks: [],
  },
  booking: {
    filterKey: "booking",
    filterLabel: "booking",
    filterLabelLong: "Bookbare shelters",
    parentHref: "/shelter-booking",
    relatedBlogLinks: [
      { label: "Gratis shelters guide", href: "/blog/gratis-shelters-i-danmark" },
    ],
  },
};

export const REGION_SLUGS = ["jylland", "sjaelland", "fyn", "bornholm"] as const;

export const REGION_NAMES: Record<string, string> = {
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
