import {
  createEditorialOgImage,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/editorial-og";
import {
  getDistinctRegions,
  getMunicipalitiesInRegion,
  getMunicipalitiesWithCounts,
  getSheltersInMunicipality,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { getAreaBySlug, getSheltersByAreaSlug, prepositionForArea, prepositionForRegionName } from "@/lib/area-db";
import { getFilterRegionCount } from "@/lib/fakta-db";
import { FILTER_CONFIGS, REGION_NAMES } from "@/lib/cross-page-config";
import { isStructuredBookable } from "@shared/lib/shelter-detail";

/**
 * Delte OG-billed-generatorer til de programmatiske undersider (region,
 * kommune, område, facet-region). Hver returnerer en ImageResponse via
 * den fælles editorial-og-skabelon, så alle landingssider får et branded
 * delings-kort i stedet for at hotlinke et generisk foto eller mangle et
 * billede helt. Bruges fra de enkelte opengraph-image.tsx-ruter.
 */

// Re-eksporter Next.js-konventionernes felter så hver opengraph-image.tsx
// blot kan: `export { size, contentType } from "@/lib/subpage-og"`.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function countSubtitle(parts: string[], fallback: string): string {
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

/** Region-side: /danmark/[region] */
export async function regionOgImage(regionSlug: string) {
  const regionName =
    REGION_NAMES[regionSlug] ??
    segmentSlugToName(regionSlug, await getDistinctRegions());
  if (!regionName) {
    return createEditorialOgImage({
      eyebrow: "Shelter i Danmark",
      title: "Shelters i naturen",
      subtitle: "Find shelters på kort og liste – med billeder, faciliteter og booking.",
      tag: "ShelterDK",
    });
  }
  const prep = prepositionForRegionName(regionName);
  const municipalities = await getMunicipalitiesWithCounts(regionName);
  const total = municipalities.reduce((sum, m) => sum + m.count, 0);

  const parts: string[] = [];
  if (total > 0) parts.push(`${total} shelter${total !== 1 ? "s" : ""}`);
  if (municipalities.length > 0) parts.push(`${municipalities.length} kommuner`);

  return createEditorialOgImage({
    eyebrow: `Region · ${regionName}`,
    title: `Shelter ${prep} ${regionName}`,
    subtitle: countSubtitle(parts, "Kort, liste, faciliteter og booking"),
    tag: "ShelterDK",
  });
}

/** Kommune-side: /danmark/[region]/[municipality] */
export async function municipalityOgImage(regionSlug: string, municipalitySlug: string) {
  const regions = await getDistinctRegions();
  const regionName = REGION_NAMES[regionSlug] ?? segmentSlugToName(regionSlug, regions);
  if (!regionName) {
    return createEditorialOgImage({
      eyebrow: "Shelter i Danmark",
      title: "Shelters i din kommune",
      subtitle: "Kort, faciliteter og lokale bysider.",
      tag: "ShelterDK",
    });
  }
  const municipalities = await getMunicipalitiesInRegion(regionName, 2);
  const municipalityName =
    municipalitySlug === NO_KOMMUNE_SLUG
      ? null
      : segmentSlugToName(municipalitySlug, municipalities);

  if (!municipalityName) {
    return createEditorialOgImage({
      eyebrow: `Region · ${regionName}`,
      title: "Shelters i kommunen",
      subtitle: "Kort, faciliteter og lokale bysider.",
      tag: "ShelterDK",
    });
  }

  const shelters = await getSheltersInMunicipality(regionName, municipalityName);
  const count = shelters.length;
  const bookable = shelters.filter((s) => isStructuredBookable(s)).length;

  const parts: string[] = [];
  if (count > 0) parts.push(`${count} shelter${count !== 1 ? "s" : ""}`);
  if (bookable > 0) parts.push(`${bookable} kan bookes`);

  return createEditorialOgImage({
    eyebrow: `${regionName}`,
    title: `Shelter i ${municipalityName} Kommune`,
    subtitle: countSubtitle(parts, "Kort, faciliteter og lokale bysider"),
    tag: "ShelterDK",
  });
}

function areaPrimaryName(name: string): string {
  const match = name.trim().match(/^(.+?)\s*\((.+)\)$/);
  return match ? match[1].trim() : name.trim();
}

/** Område-side: /omraade/[slug] */
export async function areaOgImage(slug: string) {
  const area = await getAreaBySlug(slug);
  if (!area) {
    return createEditorialOgImage({
      eyebrow: "Områder i Danmark",
      title: "Shelters i naturområderne",
      subtitle: "Områdeguides med kort, billeder og overnatning.",
      tag: "ShelterDK",
    });
  }
  const prep = prepositionForArea(area);
  const primaryName = areaPrimaryName(area.name);
  const shelters = await getSheltersByAreaSlug(slug);
  const count = shelters.length;

  return createEditorialOgImage({
    eyebrow: `Område · ${area.region}`,
    title: `Shelter ${prep} ${primaryName}`,
    subtitle:
      count > 0
        ? `${count} shelter${count !== 1 ? "s" : ""} i området · kort og overnatning`
        : "Områdeguide med kort, billeder og overnatning",
    tag: "ShelterDK",
  });
}

/** Facet-region-side, fx /shelter-med-toilet/[region] eller /shelter-booking/[region]. */
export async function facetRegionOgImage(filterKey: string, regionSlug: string) {
  const filter = FILTER_CONFIGS[filterKey];
  const regionName = REGION_NAMES[regionSlug];
  if (!filter || !regionName) {
    return createEditorialOgImage({
      eyebrow: "Shelter i Danmark",
      title: "Shelters med faciliteter",
      subtitle: "Find shelters med præcis de faciliteter du har brug for.",
      tag: "ShelterDK",
    });
  }
  const prep = prepositionForRegionName(regionName);
  const count = await getFilterRegionCount(filter.filterKey, regionName);

  return createEditorialOgImage({
    eyebrow: `${filter.filterLabelLong}`,
    title: `${filter.filterLabelLong} ${prep} ${regionName}`,
    subtitle:
      count > 0
        ? `${count} shelter${count !== 1 ? "s" : ""} ${prep} ${regionName} · kort og faciliteter`
        : "Kort, liste og faciliteter",
    tag: "ShelterDK",
  });
}
