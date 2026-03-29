import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";

export interface Area {
  slug: string;
  name: string;
  description: string | null;
  region: string;
}

/** Dansk grammatik: korrekt forholdsord for hvert område. */
const AREA_PREPOSITION: Record<string, string> = {
  // Øer → "på"
  bornholm: "på",
  lolland: "på",
  "lolland-falster": "på",
  fanoe: "på",
  samsoe: "på",
  laesoe: "på",
  // Ruter/veje → "på"
  haervejen: "på",
  // Farvande/fjorde → "ved"
  limfjorden: "ved",
  vadehavet: "ved",
};

export function prepositionForArea(area: { slug: string }): string {
  return AREA_PREPOSITION[area.slug] ?? "i";
}

/** Korrekt forholdsord for regionsnavn (Fyn, Sjælland, Bornholm → "på", resten → "i"). */
export function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  if (r === "fyn" || r === "sjælland" || r === "bornholm") return "på";
  return "i";
}

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, water, display_score";
const EMBED_SHELTER_LIMIT = 500;

/** Hent alle områder (sorteret efter navn). */
export async function getAllAreas(): Promise<Area[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("slug, name, description, region")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as Area[];
}

/** Hent område efter slug. Returnerer null hvis ikke fundet. */
export async function getAreaBySlug(slug: string): Promise<Area | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("slug, name, description, region")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as Area;
}

/** Antal shelters i et område (area_slug, ekskl. dubletter). */
export async function getShelterCountByAreaSlug(areaSlug: string): Promise<number> {
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .eq("area_slug", areaSlug)
    .is("duplicate_of_shelter_id", null);
  if (error) return 0;
  return count ?? 0;
}

/** Hent alle shelters i et område (til embed-kort). ISR/cache. */
export async function getSheltersByAreaSlug(areaSlug: string): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .eq("area_slug", areaSlug)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(EMBED_SHELTER_LIMIT);
  if (error) return [];
  return (data ?? []) as Shelter[];
}
