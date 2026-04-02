import * as SQLite from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getDatabase, getLastSyncTime, setLastSyncTime } from "../lib/database";
import type { Shelter } from "@shared/types/shelter";

const SHELTER_COLUMNS = `id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, google_photo_ref, google_places, booking_url, region, kommune, place, water, toilet, capacity, display_score, area_slug, geofa_raw, seo_description, updated_at`;

async function syncShelters(): Promise<Shelter[]> {
  const db = await getDatabase();
  const lastSync = await getLastSyncTime();

  // Try fetching from server
  let query = supabase
    .from("shelters")
    .select(SHELTER_COLUMNS)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false });

  if (lastSync) {
    query = query.gt("updated_at", lastSync);
  }

  const { data, error } = await query;

  if (error) {
    // Offline or error — return cached data
    console.warn("Supabase fetch failed, using cache:", error.message);
    return getCachedShelters(db);
  }

  if (data && data.length > 0) {
    // Upsert into SQLite (wrapped in transaction for performance with 1000+ rows)
    await db.execAsync("BEGIN");
    for (const s of data) {
      const coords = parseLocation(s.location);
      await db.runAsync(
        `INSERT OR REPLACE INTO shelters (id, slug, title, description, location, lat, lon, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, google_photo_ref, google_places, booking_url, region, kommune, place, water, toilet, capacity, display_score, area_slug, geofa_raw, seo_description, updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [s.id, s.slug, s.title, s.description, s.location, coords?.lat ?? null, coords?.lon ?? null, s.image_url, JSON.stringify(s.image_urls), JSON.stringify(s.user_image_urls), s.google_rating, s.google_user_ratings_total, s.google_place_name, s.google_photo_ref, JSON.stringify(s.google_places), s.booking_url, s.region, s.kommune, s.place, s.water, s.toilet, s.capacity, s.display_score, s.area_slug, JSON.stringify(s.geofa_raw), s.seo_description, s.updated_at]
      );
    }
    await db.execAsync("COMMIT");
    await setLastSyncTime(new Date().toISOString());
  }

  return getCachedShelters(db);
}

function parseLocation(location: string | null): { lat: number; lon: number } | null {
  if (!location) return null;
  // POINT(lon lat) format
  const match = location.match(/POINT\(([\d.-]+)\s+([\d.-]+)\)/);
  if (match) return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

async function getCachedShelters(db: SQLite.SQLiteDatabase): Promise<Shelter[]> {
  const rows = await db.getAllAsync<any>("SELECT * FROM shelters ORDER BY display_score DESC");
  return rows.map((r) => ({
    ...r,
    image_urls: r.image_urls ? JSON.parse(r.image_urls) : null,
    user_image_urls: r.user_image_urls ? JSON.parse(r.user_image_urls) : null,
    google_places: r.google_places ? JSON.parse(r.google_places) : null,
    geofa_raw: r.geofa_raw ? JSON.parse(r.geofa_raw) : null,
  }));
}

export function useShelters() {
  return useQuery({
    queryKey: ["shelters"],
    queryFn: syncShelters,
    staleTime: 5 * 60 * 1000, // 5 min before refetch
    gcTime: Infinity, // never garbage collect
  });
}
