import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, geofa_raw";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, geofa_raw";

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

/**
 * Hent én side shelters med valgfri region, søgetekst og filtre.
 * Bruges af søgesiden og API-route til paginering.
 */
export async function getSheltersPage(
  region: string | null,
  q: string | null,
  page: number,
  pageSize: number = SOEG_PAGE_SIZE,
  filters?: SoegFilters | null
): Promise<SoegPageResult> {
  const supabase = createPublicClient();
  const from = (page - 1) * pageSize;
  const toInclusive = from + pageSize - 1; // range(inclusive, inclusive) → præcis pageSize rækker

  // Prioriter: 1) med billede (image_url ikke null), 2) med anmeldelser (google_user_ratings_total), 3) titel
  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .order("image_url", { ascending: true, nullsFirst: false })
    .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (region && region.trim()) {
    query = query.eq("region", region.trim());
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

  const { data, error } = await query.range(from, toInclusive);

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
    if (q && q.trim()) {
      const term = q.trim().replace(/"/g, '""');
      const pattern = `"%${term}%"`;
      fallbackQuery = fallbackQuery.or(
        `title.ilike.${pattern},region.ilike.${pattern}`
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
    const list = ((fallbackData as Shelter[]) ?? []).slice(0, pageSize);
    return {
      shelters: list,
      hasMore: list.length >= pageSize,
    };
  }

  if (error) {
    console.error("Supabase error (soeg):", error);
    return { shelters: [], hasMore: false };
  }

  const list = ((data as Shelter[]) ?? []).slice(0, pageSize);
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
