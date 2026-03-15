import type { Shelter } from "@/types/shelter";
import { createPublicClient } from "@/utils/supabase/server-public";

/** Hent første photo_reference fra google_places for et place_id. */
export async function getFirstGooglePhotoRef(
  googlePlaceId: string | null
): Promise<string | null> {
  if (!googlePlaceId?.trim()) return null;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("google_places")
    .select("photo_references")
    .eq("google_place_id", googlePlaceId.trim())
    .single();
  const refs = (data as { photo_references?: unknown } | null)?.photo_references;
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const first = refs[0];
  return typeof first === "string" && first.trim().length > 10 ? first.trim() : null;
}

/** Hent første photo_reference for flere place_id'er (til listevisning). Returnerer Map<place_id, ref>. */
export async function getGooglePhotoRefsBatch(
  placeIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(placeIds.filter((id) => id?.trim()))];
  if (unique.length === 0) return new Map();
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("google_places")
    .select("google_place_id, photo_references")
    .in("google_place_id", unique);
  const map = new Map<string, string>();
  for (const row of (data as { google_place_id: string; photo_references?: unknown }[] | null) ?? []) {
    const refs = row.photo_references;
    if (!Array.isArray(refs) || refs.length === 0) continue;
    const first = refs[0];
    if (typeof first === "string" && first.trim().length > 10) {
      map.set(row.google_place_id, first.trim());
    }
  }
  return map;
}

/** Tilføj google_photo_ref på shelters der har google_place_id (til brug i kort). */
export async function enrichSheltersWithGooglePhotoRef(
  shelters: Shelter[]
): Promise<Shelter[]> {
  const placeIds = shelters
    .map((s) => s.google_place_id)
    .filter((id): id is string => !!id?.trim());
  if (placeIds.length === 0) return shelters;
  const refs = await getGooglePhotoRefsBatch(placeIds);
  return shelters.map((s) => {
    if (!s.google_place_id) return s;
    const ref = refs.get(s.google_place_id);
    if (!ref) return s;
    return { ...s, google_photo_ref: ref };
  });
}
