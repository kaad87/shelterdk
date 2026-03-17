import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords, getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";

/** Sorter shelters: billede først, derefter score (billeder + anmeldelser), derefter titel. */
function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff = (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, display_score, google_places!shelters_google_place_id_fkey(photo_references)";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, water, google_places!shelters_google_place_id_fkey(photo_references)";

export const SOEG_PAGE_SIZE = 24;

export interface SoegPageResult {
  shelters: Shelter[];
  hasMore: boolean;
}

export interface SoegFilters {
  billede?: boolean;
  anmeldelser?: boolean;
  bookbar?: boolean;
}

/** Bounding box for kortvisning – hent shelters inden for det synlige område. */
export interface MapBbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const BBOX_FETCH_LIMIT = 2000;

/**
 * Hent én side shelters med valgfri region, søgetekst, area_slug, filtre og bbox.
 * Ved bbox hentes op til BBOX_FETCH_LIMIT og filtreres efter koordinater (location).
 */
export async function getSheltersPage(
  region: string | null,
  q: string | null,
  page: number,
  pageSize: number = SOEG_PAGE_SIZE,
  filters?: SoegFilters | null,
  bbox?: MapBbox | null,
  areaSlug?: string | null
): Promise<SoegPageResult> {
  const supabase = createPublicClient();
  const useBbox = bbox && [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon].every((n) => Number.isFinite(n));
  const from = useBbox ? 0 : (page - 1) * pageSize;
  const toInclusive = useBbox ? BBOX_FETCH_LIMIT - 1 : from + pageSize - 1;

  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (region && region.trim()) {
    query = query.eq("region", region.trim());
  }
  if (areaSlug && areaSlug.trim()) {
    query = query.eq("area_slug", areaSlug.trim());
  }
  if (q && q.trim()) {
    const term = q.trim().replace(/"/g, '""');
    const pattern = `"%${term}%"`;
    query = query.or(
      `title.ilike.${pattern},region.ilike.${pattern},kommune.ilike.${pattern}`
    );
  }
  if (filters?.billede) {
    query = query.not("image_url", "is", null).neq("image_url", "");
  }
  if (filters?.anmeldelser) {
    query = query.not("google_user_ratings_total", "is", null).gt("google_user_ratings_total", 0);
  }
  if (filters?.bookbar) {
    query = query.not("booking_url", "is", null).neq("booking_url", "");
  }

  let { data, error } = await query.range(from, toInclusive);

  if (!error && data && useBbox && bbox) {
    const list: Shelter[] = [];
    for (const row of data as Shelter[]) {
      const coords = getLocationCoords(row);
      if (!coords) continue;
      if (
        coords.lat >= bbox.minLat &&
        coords.lat <= bbox.maxLat &&
        coords.lon >= bbox.minLon &&
        coords.lon <= bbox.maxLon
      ) {
        list.push(row);
      }
    }
    list.sort(sortByImageAndScore);
    return { shelters: list, hasMore: false };
  }

  if (error?.code === "42703") {
    let fallbackQuery = supabase
      .from("shelters")
      .select(SHELTER_SELECT_FALLBACK)
      .is("duplicate_of_shelter_id", null)
      .order("image_url", { ascending: true, nullsFirst: false })
      .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
    if (region && region.trim()) {
      fallbackQuery = fallbackQuery.eq("region", region.trim());
    }
    if (areaSlug && areaSlug.trim()) {
      fallbackQuery = fallbackQuery.eq("area_slug", areaSlug.trim());
    }
    if (q && q.trim()) {
      const term = q.trim().replace(/"/g, '""');
      const pattern = `"%${term}%"`;
      fallbackQuery = fallbackQuery.or(
        `title.ilike.${pattern},region.ilike.${pattern},kommune.ilike.${pattern}`
      );
    }
    if (filters?.billede) {
      fallbackQuery = fallbackQuery.not("image_url", "is", null).neq("image_url", "");
    }
    if (filters?.anmeldelser) {
      fallbackQuery = fallbackQuery.not("google_user_ratings_total", "is", null).gt("google_user_ratings_total", 0);
    }
    if (filters?.bookbar) {
      fallbackQuery = fallbackQuery.not("booking_url", "is", null).neq("booking_url", "");
    }
    const { data: fallbackData } = await fallbackQuery.range(from, toInclusive);
    let list = (fallbackData as Shelter[]) ?? [];
    if (useBbox && bbox) {
      list = list.filter((row) => {
        const coords = getLocationCoords(row);
        if (!coords) return false;
        return (
          coords.lat >= bbox.minLat &&
          coords.lat <= bbox.maxLat &&
          coords.lon >= bbox.minLon &&
          coords.lon <= bbox.maxLon
        );
      });
      list.sort(sortByImageAndScore);
      return { shelters: list, hasMore: false };
    }
    list = list.slice(0, pageSize);
    list.sort(sortByImageAndScore);
    return {
      shelters: list,
      hasMore: list.length >= pageSize,
    };
  }

  if (error) {
    console.error("Supabase error (soeg):", error);
    return { shelters: [], hasMore: false };
  }

  let list = ((data as Shelter[]) ?? []).slice(0, pageSize);
  list = [...list].sort(sortByImageAndScore);
  return {
    shelters: list,
    hasMore: list.length >= pageSize,
  };
}

const BYER_SUGGEST_LIMIT = 10;

/**
 * Hent bynavne (kommune) der matcher prefix – til autocomplete i søgefeltet.
 * Returnerer sorteret, unikke byer, max BYER_SUGGEST_LIMIT.
 */
export async function getByerSuggestions(prefix: string): Promise<string[]> {
  const term = (prefix || "").trim();
  if (term.length < 2) return [];

  const supabase = createPublicClient();
  const pattern = `${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const { data, error } = await supabase
    .from("shelters")
    .select("kommune")
    .is("duplicate_of_shelter_id", null)
    .not("kommune", "is", null)
    .ilike("kommune", pattern)
    .limit(80);

  if (error) {
    console.error("Supabase error (byer):", error);
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of (data as { kommune: string }[]) ?? []) {
    const k = (row.kommune || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= BYER_SUGGEST_LIMIT) break;
  }
  return out.sort((a, b) => a.localeCompare(b, "da"));
}
