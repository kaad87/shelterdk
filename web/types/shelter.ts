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
  /** By/kommune (fx fra GeoFA) – bruges til filtrering. */
  kommune?: string | null;
  /** Præcist stednavn (landsby, by) fra reverse geocoding – bruges til visning når sat. */
  place?: string | null;
  /** Godkendte brugeruploadede billed-URL'er. */
  user_image_urls?: string[] | null;
  /** Beregnet score til rangering (billeder + anmeldelser). */
  display_score?: number | null;
  /** Toilet på pladsen: flush, mulch, none, unknown. */
  toilet?: "flush" | "mulch" | "none" | "unknown" | null;
  /** Vand på pladsen (vandhane/drikkevand). */
  water?: boolean | null;
  geofa_raw?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** Ved liste-hent: navn på matchet Google-sted (for at vise rating kun ved klart match). */
  google_places?: { name: string | null } | null;
  /** Første photo_reference fra google_places – til proxy-URL for Google-billeder på kort. */
  google_photo_ref?: string | null;
  /** SEO-område (matcher areas.slug) – bruges til brødkrummer og område-landingssider. */
  area_slug?: string | null;
  /** AI-omskrevet beskrivelse til SEO (unik tekst, ingen duplicate content). */
  seo_description?: string | null;
  /** Genereret SEO-titel med bynavn. Original title bevares i title. */
  seo_title?: string | null;
}
