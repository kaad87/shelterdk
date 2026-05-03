/**
 * Data layer for /danmark/[region]/[municipality]/[shelter_slug] silo (SSG).
 * Fetches distinct regions, municipalities, and shelters from Supabase.
 */

import { createPublicClient } from "@/utils/supabase/server-public";
import { slugifySegment } from "@/lib/slug";
import { fetchAllShelterRows } from "@/lib/supabase-pagination";
import { SEARCH_SYNONYMS } from "@/lib/search-synonyms";

/** URL segment when kommune is null/empty in DB. */
export const NO_KOMMUNE_SLUG = "ukendt-kommune";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords, getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";

export const PRIORITY_BY_CITY_NAMES = [
  "Aalborg",
  "Aarhus",
  "Billund",
  "Esbjerg",
  "Helsingør",
  "Herning",
  "Holstebro",
  "Horsens",
  "Kolding",
  "København",
  "Næstved",
  "Odense",
  "Randers",
  "Roskilde",
  "Silkeborg",
  "Svendborg",
  "Vejle",
  "Viborg",
] as const;

const PRIORITY_BY_CITY_NAME_SET = new Set<string>(PRIORITY_BY_CITY_NAMES);
const BY_LANDING_SEARCH_SYNONYM_KEYS: Partial<Record<(typeof PRIORITY_BY_CITY_NAMES)[number], string>> = {
  "København": "københavn",
};

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, toilet, capacity, geofa_raw, display_score, google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";

const SHELTER_SELECT_DETAIL =
  "id, title, slug, seo_title, description, seo_description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, water, geofa_raw, area_slug, google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";

function buildByLandingMunicipalitySynonyms(placeName: string): string[] {
  const synonymKey = BY_LANDING_SEARCH_SYNONYM_KEYS[placeName as keyof typeof BY_LANDING_SEARCH_SYNONYM_KEYS];
  if (!synonymKey) return [];
  return (SEARCH_SYNONYMS[synonymKey] ?? []).map((synonym) => synonym.trim()).filter(Boolean);
}

function buildOrFiltersForTerms(column: "place" | "kommune", terms: string[]): string[] {
  return terms.map((term) => `${column}.eq.${term}`);
}

async function getSheltersForByLanding(
  placeName: string,
  municipalitySynonyms: string[]
): Promise<Shelter[]> {
  const normalizedMunicipalitySynonyms = [
    ...new Set(municipalitySynonyms.map((term) => term.trim()).filter(Boolean)),
  ];

  const supabase = createPublicClient();
  const orParts = [
    `place.eq.${placeName}`,
    `kommune.eq.${placeName}`,
    ...buildOrFiltersForTerms("kommune", normalizedMunicipalitySynonyms),
  ];

  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .or(orParts.join(","))
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (error) {
    console.error("Supabase error (shelters by landing terms):", error);
    return [];
  }

  const unique = new Map<string | number, Shelter>();
  for (const shelter of (data as Shelter[]) ?? []) {
    unique.set(shelter.id, shelter);
  }

  const shelters = [...unique.values()];
  shelters.sort(sortByImageAndScore);
  return shelters;
}

function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff = (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

/** Distinct regions that have at least one shelter (no duplicates, exclude null/empty). */
export async function getDistinctRegions(): Promise<string[]> {
  let data: { region: string }[];
  try {
    data = await fetchAllShelterRows<{ region: string }>("region", (query) =>
      query.not("region", "is", null).neq("region", "")
    );
  } catch (error) {
    console.error("Supabase error (distinct regions):", error);
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const r = (row.region || "").trim();
    if (!r || seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out.sort((a, b) => a.localeCompare(b, "da"));
}

/** Distinct (region, kommune) pairs; kommune can be null – we treat as "Ukendt kommune" for routing.
 *  When minShelters is set, only returns pairs with at least that many shelters. */
export async function getRegionKommunePairs(
  minShelters?: number
): Promise<{ region: string; kommune: string | null }[]> {
  let rows: { region: string; kommune: string | null }[];
  try {
    rows = await fetchAllShelterRows<{ region: string; kommune: string | null }>(
      "region, kommune",
      (query) => query.not("region", "is", null).neq("region", "")
    );
  } catch (error) {
    console.error("Supabase error (region/kommune pairs):", error);
    return [];
  }

  if (minShelters != null && minShelters > 0) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const region = (row.region || "").trim();
      const kommune =
        row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
      if (!region) continue;
      const key = `${region}\n${kommune ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const seen = new Set<string>();
    const out: { region: string; kommune: string | null }[] = [];
    for (const row of rows) {
      const region = (row.region || "").trim();
      const kommune =
        row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
      const key = `${region}\n${kommune ?? ""}`;
      if (!region || seen.has(key) || (counts.get(key) ?? 0) < minShelters) continue;
      seen.add(key);
      out.push({ region, kommune });
    }
    return out.sort((a, b) => {
      const c = a.region.localeCompare(b.region, "da");
      return c !== 0 ? c : (a.kommune ?? "").localeCompare(b.kommune ?? "", "da");
    });
  }

  const seen = new Set<string>();
  const out: { region: string; kommune: string | null }[] = [];
  for (const row of rows) {
    const region = (row.region || "").trim();
    const kommune =
      row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
    const key = `${region}\n${kommune ?? ""}`;
    if (!region || seen.has(key)) continue;
    seen.add(key);
    out.push({ region, kommune });
  }
  return out.sort((a, b) => {
    const c = a.region.localeCompare(b.region, "da");
    return c !== 0 ? c : (a.kommune ?? "").localeCompare(b.kommune ?? "", "da");
  });
}

/** All shelters with region and kommune for generateStaticParams (shelter_slug pages). */
export async function getSheltersForStaticParams(): Promise<
  { region: string; kommune: string | null; slug: string }[]
> {
  let rows: { region: string; kommune: string | null; slug: string }[];
  try {
    rows = await fetchAllShelterRows<{ region: string; kommune: string | null; slug: string }>(
      "region, kommune, slug",
      (query) => query.not("region", "is", null).neq("region", "").not("slug", "is", null)
    );
  } catch (error) {
    console.error("Supabase error (shelters for params):", error);
    return [];
  }

  const out: { region: string; kommune: string | null; slug: string }[] = [];
  for (const row of rows) {
    const region = (row.region || "").trim();
    const kommune = row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
    const slug = (row.slug || "").trim();
    if (!region || !slug) continue;
    out.push({ region, kommune, slug });
  }
  return out;
}

/** Municipalities with shelter counts for a given region. Sorted by count desc, then name. */
export async function getMunicipalitiesWithCounts(
  region: string
): Promise<{ name: string; count: number }[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("kommune")
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .not("kommune", "is", null)
    .neq("kommune", "");

  if (error) {
    console.error("Supabase error (municipalities with counts):", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of (data as { kommune: string }[]) ?? []) {
    const k = (row.kommune || "").trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "da"));
}

/** Municipalities (kommune) in a given region. When minShelters is set, only returns
 *  municipalities with at least that many shelters. */
export async function getMunicipalitiesInRegion(
  region: string,
  minShelters?: number
): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("kommune")
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .not("kommune", "is", null)
    .neq("kommune", "");

  if (error) {
    console.error("Supabase error (municipalities in region):", error);
    return [];
  }

  const rows = (data as { kommune: string }[]) ?? [];

  if (minShelters != null && minShelters > 0) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const k = (row.kommune || "").trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const k = (row.kommune || "").trim();
      if (!k || seen.has(k) || (counts.get(k) ?? 0) < minShelters) continue;
      seen.add(k);
      out.push(k);
    }
    return out.sort((a, b) => a.localeCompare(b, "da"));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const k = (row.kommune || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.sort((a, b) => a.localeCompare(b, "da"));
}

/** Top shelters in a region (for region landing page). Sorted by display_score / image. */
export async function getTopSheltersInRegion(
  region: string,
  limit: number = 12
): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(Math.min(limit, 100));

  if (error) {
    console.error("Supabase error (top shelters region):", error);
    return [];
  }
  const list = (data as Shelter[]) ?? [];
  list.sort(sortByImageAndScore);
  return list.slice(0, limit);
}

/** Shelters in a region + municipality. Pass null/empty for "unknown municipality". */
export async function getSheltersInMunicipality(
  region: string,
  kommune: string | null
): Promise<Shelter[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (kommune != null && kommune !== "") {
    query = query.eq("kommune", kommune);
  } else {
    query = query.or("kommune.is.null,kommune.eq.");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase error (shelters municipality):", error);
    return [];
  }
  const list = (data as Shelter[]) ?? [];
  list.sort(sortByImageAndScore);
  return list;
}

/** Reviews for a Google Place (for shelter detail page). */
export async function getReviews(googlePlaceId: string | null): Promise<
  { author_name: string | null; rating: number | null; text: string | null; relative_time_description: string | null; time: string | null }[]
> {
  if (!googlePlaceId) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("google_place_reviews")
    .select("author_name, rating, text, relative_time_description, time")
    .eq("google_place_id", googlePlaceId)
    .order("time", { ascending: false })
    .limit(5);
  return (data || []) as {
    author_name: string | null;
    rating: number | null;
    text: string | null;
    relative_time_description: string | null;
    time: string | null;
  }[];
}

/** Single shelter by slug (for detail page). Returns full detail for gallery, features, etc. */
export async function getShelterBySlugInSilo(slug: string): Promise<{
  shelter: Shelter | null;
  region: string | null;
  kommune: string | null;
}> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_DETAIL)
    .eq("slug", slug)
    .is("duplicate_of_shelter_id", null)
    .single();

  if (error || !data) {
    return { shelter: null, region: null, kommune: null };
  }
  const row = data as Shelter & { region?: string; kommune?: string | null };
  return {
    shelter: row as Shelter,
    region: (row.region ?? "").trim() || null,
    kommune: row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null,
  };
}

/** Get shelter by slug inkl. duplicates. Til brug ved fallback – hvis slug matcher en duplicate, returnerer vi den. */
export async function getShelterBySlugIncludingDuplicates(slug: string): Promise<{
  shelter: Shelter | null;
  region: string | null;
  kommune: string | null;
}> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(`${SHELTER_SELECT_DETAIL}, duplicate_of_shelter_id`)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return { shelter: null, region: null, kommune: null };
  }
  const row = data as Shelter & { region?: string; kommune?: string | null };
  return {
    shelter: row as Shelter,
    region: (row.region ?? "").trim() || null,
    kommune: row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null,
  };
}

/** Hent kanonisk shelter (fra duplicate_of_shelter_id) med region/kommune/slug til silo-URL. */
export async function getCanonicalShelterForRedirect(
  duplicateOfId: string
): Promise<{ region: string; kommune: string | null; slug: string } | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region, kommune, slug")
    .eq("id", duplicateOfId)
    .is("duplicate_of_shelter_id", null)
    .single();

  if (error || !data) return null;
  const row = data as { region: string | null; kommune: string | null; slug: string };
  const region = (row.region ?? "").trim();
  const slug = (row.slug ?? "").trim();
  if (!region || !slug) return null;
  const kommune = row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
  return { region, kommune, slug };
}

/** Distinct `place` values with shelter counts. Only returns places with >= minCount shelters. */
export async function getDistinctPlacesWithCounts(
  minCount = 1
): Promise<{ place: string; count: number }[]> {
  let data: { place: string | null }[];
  try {
    data = await fetchAllShelterRows<{ place: string | null }>("place");
  } catch (error) {
    console.error("Supabase error (distinct places):", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const p = (row.place || "").trim();
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([place, count]) => ({ place, count }))
    .sort((a, b) => a.place.localeCompare(b.place, "da"));
}

/** Distinct `kommune` values with shelter counts. Only returns municipalities with >= minCount shelters. */
export async function getDistinctMunicipalitiesWithCounts(
  minCount = 1
): Promise<{ kommune: string; count: number }[]> {
  let data: { kommune: string | null }[];
  try {
    data = await fetchAllShelterRows<{ kommune: string | null }>("kommune");
  } catch (error) {
    console.error("Supabase error (distinct municipalities):", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const kommune = (row.kommune || "").trim();
    if (!kommune) continue;
    counts.set(kommune, (counts.get(kommune) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([kommune, count]) => ({ kommune, count }))
    .sort((a, b) => a.kommune.localeCompare(b.kommune, "da"));
}

export function buildDistinctByLandingPages(
  shelterRows: { id: string | number; place: string | null; kommune: string | null }[],
  minCount = 1
): { place: string; count: number }[] {
  const placeIds = new Map<string, Set<string | number>>();
  const kommuneIds = new Map<string, Set<string | number>>();

  for (const row of shelterRows) {
    const id = row.id;
    const place = (row.place || "").trim();
    const kommune = (row.kommune || "").trim();

    if (place) {
      if (!placeIds.has(place)) placeIds.set(place, new Set());
      placeIds.get(place)!.add(id);
    }
    if (kommune) {
      if (!kommuneIds.has(kommune)) kommuneIds.set(kommune, new Set());
      kommuneIds.get(kommune)!.add(id);
    }
  }

  const pageNames = new Set<string>([...placeIds.keys(), ...PRIORITY_BY_CITY_NAMES]);

  const pages: { place: string; count: number }[] = [];
  for (const placeName of pageNames) {
    const exactPlaceIds = placeIds.get(placeName) ?? new Set<string | number>();
    const matchingMunicipalityIds = kommuneIds.get(placeName) ?? new Set<string | number>();
    const municipalitySynonyms = buildByLandingMunicipalitySynonyms(placeName);
    const synonymIds = new Set<string | number>();
    for (const term of municipalitySynonyms) {
      for (const id of kommuneIds.get(term) ?? []) synonymIds.add(id);
    }

    const usesMunicipalityExpansion =
      matchingMunicipalityIds.size > exactPlaceIds.size || synonymIds.size > 0;

    const effectiveIds = usesMunicipalityExpansion
      ? new Set<string | number>([
          ...exactPlaceIds,
          ...matchingMunicipalityIds,
          ...synonymIds,
        ])
      : exactPlaceIds;

    if (effectiveIds.size >= minCount) {
      pages.push({ place: placeName, count: effectiveIds.size });
    }
  }

  return pages.sort((a, b) => a.place.localeCompare(b.place, "da"));
}

/**
 * Landing pages for `/by/*`.
 * Uses distinct `place` values as the default page universe, upgrades counts when a municipality
 * with the same name has more shelters, and adds municipality-only fallbacks for key city pages.
 */
export async function getDistinctByLandingPages(
  minCount = 1
): Promise<{ place: string; count: number }[]> {
  let data: { id: string | number; place: string | null; kommune: string | null }[];
  try {
    data = await fetchAllShelterRows<{ id: string | number; place: string | null; kommune: string | null }>(
      "id, place, kommune"
    );
  } catch (error) {
    console.error("Supabase error (by landing pages):", error);
    return [];
  }

  return buildDistinctByLandingPages(data, minCount);
}

/** All shelters whose `place` matches the given value. */
export async function getSheltersByPlace(place: string): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .eq("place", place)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (error) {
    console.error("Supabase error (shelters by place):", error);
    return [];
  }
  const list = (data as Shelter[]) ?? [];
  list.sort(sortByImageAndScore);
  return list;
}

/** All shelters whose `kommune` matches the given value. */
export async function getSheltersByMunicipalityName(kommune: string): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .eq("kommune", kommune)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (error) {
    console.error("Supabase error (shelters by municipality name):", error);
    return [];
  }
  const list = (data as Shelter[]) ?? [];
  list.sort(sortByImageAndScore);
  return list;
}

/**
 * Data for `/by/[slug]` pages.
 * We primarily use `place`, but if a municipality with the same name contains more shelters,
 * we expand the page to cover the broader by/kommune-intent users typically search for.
 */
export async function getByLandingData(placeName: string): Promise<{
  shelters: Shelter[];
  placeCount: number;
  municipalityCount: number;
  usesMunicipalityExpansion: boolean;
}> {
  const municipalitySynonyms = buildByLandingMunicipalitySynonyms(placeName);

  const [placeShelters, municipalityShelters, effectiveShelters] = await Promise.all([
    getSheltersByPlace(placeName),
    getSheltersByMunicipalityName(placeName),
    getSheltersForByLanding(placeName, municipalitySynonyms),
  ]);

  const usesMunicipalityExpansion =
    municipalityShelters.length > placeShelters.length || municipalitySynonyms.length > 0;

  return {
    shelters: usesMunicipalityExpansion ? effectiveShelters : placeShelters,
    placeCount: placeShelters.length,
    municipalityCount: municipalityShelters.length,
    usesMunicipalityExpansion,
  };
}

export function shouldRedirectMunicipalityToByPage(
  municipalityName: string,
  municipalityShelters: Array<Pick<Shelter, "id">>,
  byShelters: Array<Pick<Shelter, "id">>
): boolean {
  if (!PRIORITY_BY_CITY_NAME_SET.has(municipalityName)) return false;
  if (municipalityShelters.length === 0 || byShelters.length === 0) return false;
  if (municipalityShelters.length !== byShelters.length) return false;

  const byIds = new Set(byShelters.map((shelter) => shelter.id));
  return municipalityShelters.every((shelter) => byIds.has(shelter.id));
}

export { slugifySegment };
