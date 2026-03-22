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
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, toilet, capacity, geofa_raw, display_score, google_places!shelters_google_place_id_fkey(photo_references)";
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
  vand?: boolean;
  toilet?: boolean;
  hund?: boolean;
  baalplads?: boolean;
  gratis?: boolean;
  handicap?: boolean;
  bord_baenk?: boolean;
  strand?: boolean;
  bruser?: boolean;
  min_pladser?: number;
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
export type SoegSort = "standard" | "rating" | "reviews";

export async function getSheltersPage(
  region: string | null,
  q: string | null,
  page: number,
  pageSize: number = SOEG_PAGE_SIZE,
  filters?: SoegFilters | null,
  bbox?: MapBbox | null,
  areaSlug?: string | null,
  sort?: SoegSort | null
): Promise<SoegPageResult> {
  const supabase = createPublicClient();
  const useBbox = bbox && [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon].every((n) => Number.isFinite(n));
  const from = useBbox ? 0 : (page - 1) * pageSize;
  const toInclusive = useBbox ? BBOX_FETCH_LIMIT - 1 : from + pageSize - 1;

  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null);

  // Apply sort order
  if (sort === "rating") {
    query = query
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  } else if (sort === "reviews") {
    query = query
      .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  } else {
    query = query
      .order("display_score", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  }

  if (region && region.trim()) {
    query = query.eq("region", region.trim());
  }
  if (areaSlug && areaSlug.trim()) {
    query = query.eq("area_slug", areaSlug.trim());
  }
  if (q && q.trim()) {
    const term = q.trim().replace(/"/g, '""');
    const pattern = `"%${term}%"`;

    // Find area_slugs der matcher søgetermen (fx "Nationalpark Thy" → "nationalpark-thy")
    const { data: matchingAreas } = await supabase
      .from("areas")
      .select("slug")
      .ilike("name", `%${term}%`)
      .limit(5);

    let orParts = `title.ilike.${pattern},region.ilike.${pattern},kommune.ilike.${pattern},place.ilike.${pattern}`;
    if (matchingAreas && matchingAreas.length > 0) {
      // Tilføj area_slug matches til OR-filteret
      const areaSlugs = matchingAreas.map((a: { slug: string }) => `area_slug.eq.${a.slug}`).join(",");
      orParts += `,${areaSlugs}`;
    }

    query = query.or(orParts);
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
  if (filters?.vand) {
    query = query.eq("water", true);
  }
  if (filters?.toilet) {
    query = query.in("toilet", ["flush", "mulch"]);
  }
  if (filters?.hund) {
    query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
  }
  if (filters?.baalplads) {
    query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
  }
  if (filters?.gratis) {
    query = query.filter("geofa_raw->>betaling", "eq", "Nej");
  }
  if (filters?.handicap) {
    query = query.or("geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet");
  }
  if (filters?.bord_baenk) {
    query = query.filter("geofa_raw->>bord_baenk", "eq", "Ja");
  }
  if (filters?.strand) {
    query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
  }
  if (filters?.bruser) {
    query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja");
  }
  if (filters?.min_pladser && filters.min_pladser > 0) {
    query = query.gte("capacity", filters.min_pladser);
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
      .is("duplicate_of_shelter_id", null);
    if (sort === "rating") {
      fallbackQuery = fallbackQuery
        .order("google_rating", { ascending: false, nullsFirst: false })
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    } else if (sort === "reviews") {
      fallbackQuery = fallbackQuery
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("google_rating", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    } else {
      fallbackQuery = fallbackQuery
        .order("image_url", { ascending: true, nullsFirst: false })
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    }
    if (region && region.trim()) {
      fallbackQuery = fallbackQuery.eq("region", region.trim());
    }
    if (areaSlug && areaSlug.trim()) {
      fallbackQuery = fallbackQuery.eq("area_slug", areaSlug.trim());
    }
    if (q && q.trim()) {
      const term = q.trim().replace(/"/g, '""');
      const pattern = `"%${term}%"`;
      // Genbrug matchingAreas fra den primære query hvis tilgængelig
      const { data: fbAreas } = await supabase
        .from("areas")
        .select("slug")
        .ilike("name", `%${term}%`)
        .limit(5);
      let fbOrParts = `title.ilike.${pattern},region.ilike.${pattern},kommune.ilike.${pattern}`;
      if (fbAreas && fbAreas.length > 0) {
        fbOrParts += `,${fbAreas.map((a: { slug: string }) => `area_slug.eq.${a.slug}`).join(",")}`;
      }
      fallbackQuery = fallbackQuery.or(fbOrParts);
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
    if (filters?.vand) {
      fallbackQuery = fallbackQuery.eq("water", true);
    }
    if (filters?.toilet) {
      fallbackQuery = fallbackQuery.in("toilet", ["flush", "mulch"]);
    }
    if (filters?.hund) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
    }
    if (filters?.baalplads) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>baalplads", "ilike", "%ja%");
    }
    if (filters?.gratis) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>betaling", "eq", "Nej");
    }
    if (filters?.handicap) {
      fallbackQuery = fallbackQuery.or("geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet");
    }
    if (filters?.bord_baenk) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>bord_baenk", "eq", "Ja");
    }
    if (filters?.strand) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
    }
    if (filters?.bruser) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>bruser_bad", "eq", "Ja");
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
  // Only apply default client sort when using standard sort (server already sorted)
  if (!sort || sort === "standard") {
    list = [...list].sort(sortByImageAndScore);
  }
  return {
    shelters: list,
    hasMore: list.length >= pageSize,
  };
}

const SUGGEST_LIMIT = 10;

export interface SearchSuggestion {
  name: string;
  type: "by" | "område";
}

/**
 * Hent byer (kommune) og områder (place) der matcher prefix – til autocomplete.
 * Returnerer sorteret, unikke forslag med type-markør, max SUGGEST_LIMIT.
 */
export async function getSuggestions(prefix: string): Promise<SearchSuggestion[]> {
  const term = (prefix || "").trim();
  if (term.length < 2) return [];

  const supabase = createPublicClient();
  const pattern = `${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const containsPattern = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  // Hent kommuner, områder og navngivne areas parallelt
  const [kommuneRes, placeRes, areaRes] = await Promise.all([
    supabase
      .from("shelters")
      .select("kommune")
      .is("duplicate_of_shelter_id", null)
      .not("kommune", "is", null)
      .ilike("kommune", pattern)
      .limit(80),
    supabase
      .from("shelters")
      .select("place")
      .is("duplicate_of_shelter_id", null)
      .not("place", "is", null)
      .ilike("place", containsPattern)
      .limit(80),
    supabase
      .from("areas")
      .select("name")
      .ilike("name", containsPattern)
      .limit(20),
  ]);

  if (kommuneRes.error) console.error("Supabase error (kommune suggestions):", kommuneRes.error);
  if (placeRes.error) console.error("Supabase error (place suggestions):", placeRes.error);
  if (areaRes.error) console.error("Supabase error (area suggestions):", areaRes.error);

  const seen = new Set<string>();
  const results: SearchSuggestion[] = [];

  // Byer først (eksakt prefix-match)
  for (const row of (kommuneRes.data as { kommune: string }[]) ?? []) {
    const k = (row.kommune || "").trim();
    const key = k.toLowerCase();
    if (!k || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: k, type: "by" });
  }

  // Navngivne områder fra areas-tabellen (nationalparker, øer m.m.)
  for (const row of (areaRes.data as { name: string }[]) ?? []) {
    const a = (row.name || "").trim();
    const key = a.toLowerCase();
    if (!a || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: a, type: "område" });
  }

  // Områder fra place-feltet (contains-match, undgå duplikater)
  for (const row of (placeRes.data as { place: string }[]) ?? []) {
    const p = (row.place || "").trim();
    const key = p.toLowerCase();
    if (!p || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: p, type: "område" });
  }

  // Sortér: eksakte prefix-matches først, derefter alfabetisk
  const lowerTerm = term.toLowerCase();
  results.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(lowerTerm) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(lowerTerm) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.name.localeCompare(b.name, "da");
  });

  return results.slice(0, SUGGEST_LIMIT);
}

/** Baglæns-kompatibel: returnerer bare bynavne som strings. */
export async function getByerSuggestions(prefix: string): Promise<string[]> {
  const suggestions = await getSuggestions(prefix);
  return suggestions.map((s) => s.name);
}
