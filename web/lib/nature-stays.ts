import { slugifySegment } from "@/lib/slug";
import { createPublicClient } from "@/utils/supabase/server-public";

/**
 * Kurateret naturophold-/glamping-datalag (affiliate). Spejler buying_guides-
 * systemet. Fase 1: typer + rene helpers. DB-funktioner tilføjes i senere tasks.
 */

export type StayLinkSource = "booking_com" | "direkte" | "andet_netvaerk";
export type StayStatus = "draft" | "published";

export interface NatureStay {
  id: number;
  slug: string;
  name: string;
  operator_name: string | null;
  type: string;
  region: string | null;
  kommune: string | null;
  place: string | null;
  location: string | null; // 'POINT(lng lat)' WKT
  short_description: string | null;
  body_md: string | null;
  image_url: string | null;
  image_urls: string[];
  image_permission: string | null;
  price_from: number | null;
  capacity: number | null;
  amenities: Record<string, unknown>;
  rating: number | null;
  booking_url: string | null;
  link_source: StayLinkSource;
  featured: boolean;
  sort_boost: number;
  status: StayStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StayGuide {
  id: number;
  slug: string;
  title: string;
  intro: string | null;
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ title: string; url: string }>;
  author: string | null;
  parent_slug: string | null;
  status: StayStatus;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StayGuideEntry {
  id: number;
  guide_id: number;
  nature_stay_id: number;
  rank: number;
  award_label: string | null;
  best_for: string | null;
  editorial_note: string | null;
  created_at: string;
}

/** Nærhedssøgnings-resultat fra get_nearby_stays-RPC (Plan B). */
export interface NearbyStay {
  id: number;
  slug: string;
  name: string;
  type: string;
  image_url: string | null;
  region: string | null;
  kommune: string | null;
  place: string | null;
  price_from: number | null;
  booking_url: string | null;
  link_source: StayLinkSource;
  distance_km: number;
}

export const STAY_SELECT_COLS =
  "id, slug, name, operator_name, type, region, kommune, place, location, short_description, body_md, image_url, image_urls, image_permission, price_from, capacity, amenities, rating, booking_url, link_source, featured, sort_boost, status, last_verified_at, created_at, updated_at";

export const STAY_GUIDE_SELECT_COLS =
  "id, slug, title, intro, body_md, seo_title, seo_description, faq, sources, author, parent_slug, status, last_reviewed_at, created_at, updated_at";

/** URL-venlig slug for et sted (samme regler som silo-ruter: æ→ae, ø→oe, å→aa). */
export const slugifyStayName = slugifySegment;

/** Bygger 'POINT(lng lat)' WKT til location-kolonnen (samme konvention som shelters). */
export function toPointWkt(lng: number, lat: number): string {
  return `POINT(${lng} ${lat})`;
}

/** Affiliate-disclosure-tekst, varieret efter linkkilde — ærlig og kort. */
export function stayDisclosure(source: StayLinkSource): string {
  switch (source) {
    case "booking_com":
      return "Vi linker til Booking.com og kan tjene en kommission, hvis du booker. Det påvirker ikke vores vurdering.";
    case "direkte":
      return "Vi har en direkte aftale med stedet og kan tjene en kommission ved booking. Det påvirker ikke vores vurdering.";
    case "andet_netvaerk":
      return "Vi kan tjene en kommission, hvis du booker via linket. Det påvirker ikke vores vurdering.";
  }
}

/** Et sted må kun publiceres med billede OG dokumenteret billedtilladelse (spec §1). */
export function canPublishStay(stay: Pick<NatureStay, "image_url" | "image_permission">): boolean {
  return Boolean(stay.image_url && stay.image_url.trim() && stay.image_permission && stay.image_permission.trim());
}

interface RpcRunner {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

/**
 * De nærmeste PUBLICEREDE naturophold inden for radius af et punkt (Plan B).
 * Kalder PostGIS-RPC'en get_nearby_stays. Klient kan injiceres (test).
 */
export async function getNearbyStays(
  lat: number,
  lng: number,
  opts: { radiusKm?: number; limit?: number } = {},
  client?: RpcRunner
): Promise<NearbyStay[]> {
  const sb = client ?? (createPublicClient() as unknown as RpcRunner);
  const { data, error } = await sb.rpc("get_nearby_stays", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: opts.radiusKm ?? 25,
    p_limit: opts.limit ?? 3,
  });
  if (error) {
    console.error("getNearbyStays", error);
    return [];
  }
  return (data as NearbyStay[]) ?? [];
}
