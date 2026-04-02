import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getDatabase } from "../lib/database";

export function useShelterDetail(slug: string) {
  return useQuery({
    queryKey: ["shelter", slug],
    queryFn: async () => {
      // Try Supabase first
      const { data, error } = await supabase
        .from("shelters")
        .select("*")
        .eq("slug", slug)
        .single();

      if (data) return data;

      // Fallback to SQLite cache
      const db = await getDatabase();
      const cached = await db.getFirstAsync<any>("SELECT * FROM shelters WHERE slug = ?", [slug]);
      if (cached) {
        return {
          ...cached,
          geofa_raw: cached.geofa_raw ? JSON.parse(cached.geofa_raw) : null,
          image_urls: cached.image_urls ? JSON.parse(cached.image_urls) : null,
          user_image_urls: cached.user_image_urls ? JSON.parse(cached.user_image_urls) : null,
          google_places: cached.google_places ? JSON.parse(cached.google_places) : null,
        };
      }

      throw new Error("Shelter not found");
    },
  });
}
