export interface Shelter {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null; // POINT(lon lat) fra DB
  image_url: string | null;
  /** Ekstra billed-URL'er (jsonb array i DB). */
  image_urls?: string[] | null;
  google_rating: number | null;
  google_user_ratings_total: number | null;
  booking_url: string | null;
  google_place_id?: string | null;
  google_place_name?: string | null;
  duplicate_of_shelter_id: string | null;
  region?: string | null;
  /** By/kommune (fx fra GeoFA beliggenhedskommune). */
  kommune?: string | null;
  geofa_raw?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** Ved liste-hent: navn på matchet Google-sted (for at vise rating kun ved klart match). */
  google_places?: { name: string | null } | null;
}
