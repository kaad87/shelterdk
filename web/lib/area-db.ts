import { createPublicClient } from "@/utils/supabase/server-public";

export interface Area {
  slug: string;
  name: string;
  description: string | null;
  region: string;
}

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
