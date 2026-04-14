/**
 * Henter shelters hvor der er toilet (flush eller mulch).
 * Bruges til SEO-landingssiden /shelter-med-toilet.
 */

import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, display_score, blur_data_url";

function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff = (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

/** Hent shelters med toilet (vandskyllende eller muldtoilet). Max limit stk. */
export async function getSheltersWithToilet(limit: number = 50): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .in("toilet", ["flush", "mulch"])
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Supabase error (shelters with toilet):", error);
    return [];
  }

  const list = (data as Shelter[]) ?? [];
  list.sort(sortByImageAndScore);
  return list;
}
