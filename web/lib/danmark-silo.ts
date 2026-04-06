/**
 * Data layer for /danmark/[region]/[municipality]/[shelter_slug] silo (SSG).
 * Fetches distinct regions, municipalities, and shelters from Supabase.
 */

import { createPublicClient } from "@/utils/supabase/server-public";
import { slugifySegment } from "@/lib/slug";

/** URL segment when kommune is null/empty in DB. */
export const NO_KOMMUNE_SLUG = "ukendt-kommune";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords, getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, display_score, google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";

const SHELTER_SELECT_DETAIL =
  "id, title, slug, seo_title, description, seo_description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, water, geofa_raw, area_slug, google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";

function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff = (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

/** Distinct regions that have at least one shelter (no duplicates, exclude null/empty). */
export async function getDistinctRegions(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region")
    .is("duplicate_of_shelter_id", null)
    .not("region", "is", null)
    .neq("region", "");

  if (error) {
    console.error("Supabase error (distinct regions):", error);
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of (data as { region: string }[]) ?? []) {
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
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region, kommune")
    .is("duplicate_of_shelter_id", null)
    .not("region", "is", null)
    .neq("region", "");

  if (error) {
    console.error("Supabase error (region/kommune pairs):", error);
    return [];
  }

  const rows = (data as { region: string; kommune: string | null }[]) ?? [];

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
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region, kommune, slug")
    .is("duplicate_of_shelter_id", null)
    .not("region", "is", null)
    .neq("region", "")
    .not("slug", "is", null);

  if (error) {
    console.error("Supabase error (shelters for params):", error);
    return [];
  }

  const out: { region: string; kommune: string | null; slug: string }[] = [];
  for (const row of (data as { region: string; kommune: string | null; slug: string }[]) ?? []) {
    const region = (row.region || "").trim();
    const kommune = row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
    const slug = (row.slug || "").trim();
    if (!region || !slug) continue;
    out.push({ region, kommune, slug });
  }
  return out;
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

export { slugifySegment };
