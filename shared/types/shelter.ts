/** A photo item for the gallery editor — URL plus whether the owner can delete it. */
export interface PhotoItem {
  url: string;
  isDeletable: boolean;
}

export type ShelterBookingProvider =
  | "shelterdk"
  | "naturstyrelsen"
  | "udinaturen"
  | "kommune"
  | "private"
  | "unknown";

export type ShelterBookingLinkMode =
  | "internal"
  | "external_direct"
  | "external_search"
  | "contact_only"
  | "first_come";

export type ShelterBookingConfidence =
  | "manual"
  | "verified_match"
  | "imported"
  | "heuristic";

export type ShelterAvailabilityProvider =
  | "shelterdk"
  | "naturstyrelsen"
  | "unknown";

export type ShelterAvailabilityMode =
  | "internal_live"
  | "external_cached"
  | "external_unknown"
  | "none";

export type ShelterAvailabilityConfidence =
  | "manual"
  | "verified_match"
  | "imported"
  | "heuristic";

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
  /** Antal pladser/sovepladser. */
  capacity?: number | null;
  geofa_raw?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** Ved liste-hent: join til google_places (Supabase embed kan komme som array). */
  google_places?:
    | { name?: string | null; photo_references?: string[] | null }
    | { name?: string | null; photo_references?: string[] | null }[]
    | null;
  /** Første photo_reference fra google_places – til proxy-URL for Google-billeder på kort. */
  google_photo_ref?: string | null;
  /** SEO-område (matcher areas.slug) – bruges til brødkrummer og område-landingssider. */
  area_slug?: string | null;
  /** AI-omskrevet beskrivelse til SEO (unik tekst, ingen duplicate content). */
  seo_description?: string | null;
  /** Genereret SEO-titel med bynavn. Original title bevares i title. */
  seo_title?: string | null;
  /** Base64-encoded tiny blur preview of first image (LQIP). */
  blur_data_url?: string | null;
  /** Custom display order for all photos. null = use default order. */
  photo_order?: string[] | null;
  /** Manuel rangering-boost — højere værdi = vises øverst. 0 = ingen boost. */
  featured_sort_boost?: number | null;
  /** Hvilken bookingudbyder shelteret bruger, når den er kendt. */
  booking_provider?: ShelterBookingProvider | null;
  /** Hvordan booking skal præsenteres for brugeren. */
  booking_link_mode?: ShelterBookingLinkMode | null;
  /** Evt. ekstern lookup-nøgle, fx Naturstyrelsen-slug. */
  booking_lookup_key?: string | null;
  /** Hvornår booking_url sidst blev verificeret som direkte link. */
  booking_url_verified_at?: string | null;
  /** Hvor sikkert booking-linket/matchningen er. */
  booking_confidence?: ShelterBookingConfidence | null;
  /** Availability-udbyder til ShelterDK's egne kalendere/søgning. */
  availability_provider?: ShelterAvailabilityProvider | null;
  /** Hvordan availability-data hentes/vises. */
  availability_mode?: ShelterAvailabilityMode | null;
  /** Evt. ekstern lookup-nøgle, fx Naturstyrelsen PID. */
  availability_lookup_key?: string | null;
  /** Kilde-URL som availability-data er koblet til. */
  availability_url?: string | null;
  /** Hvornår availability-koblingen sidst blev verificeret. */
  availability_verified_at?: string | null;
  /** Hvor sikkert availability-matchningen er. */
  availability_confidence?: ShelterAvailabilityConfidence | null;
  /** Bookable units på ShelterDK — non-empty array betyder sheltered kan bookes direkte her. */
  bookable_shelters?: { id: string }[] | null;
}
