import { createClient } from "@supabase/supabase-js";
import { slugifySegment } from "@/lib/slug";

/** Service-role-klient til server-side læsning (offentlige sider læser via server, filtrerer status). */
function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

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
  const sb = client ?? (getServiceClient() as unknown as RpcRunner);
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

/** Entry + det fulde sted (kun publicerede steder, sorteret efter rank). */
export interface StayEntryWithStay {
  id: number;
  rank: number;
  award_label: string | null;
  best_for: string | null;
  editorial_note: string | null;
  stay: NatureStay;
}

export async function getPublishedStayGuides(): Promise<StayGuide[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("stay_guides")
    .select(STAY_GUIDE_SELECT_COLS)
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  return (data as StayGuide[]) ?? [];
}

export async function getPublishedStayGuideSlugs(): Promise<string[]> {
  return (await getPublishedStayGuides()).map((g) => g.slug);
}

export async function getStayGuideBySlug(
  slug: string
): Promise<{ guide: StayGuide; entries: StayEntryWithStay[] } | null> {
  const sb = getServiceClient();
  const { data: guide } = await sb
    .from("stay_guides")
    .select(STAY_GUIDE_SELECT_COLS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!guide) return null;

  const { data: rawEntries } = await sb
    .from("stay_guide_entries")
    .select("id, rank, award_label, best_for, editorial_note, nature_stay_id")
    .eq("guide_id", (guide as StayGuide).id);

  const ids = (rawEntries ?? []).map((e) => e.nature_stay_id as number);
  if (ids.length === 0) return { guide: guide as StayGuide, entries: [] };

  // Kun publicerede steder vises offentligt (en draft-stay i en guide skjules).
  const { data: stays } = await sb.from("nature_stays").select(STAY_SELECT_COLS).in("id", ids).eq("status", "published");
  const byId = new Map(((stays ?? []) as NatureStay[]).map((s) => [s.id, s]));

  const entries: StayEntryWithStay[] = (rawEntries ?? [])
    .map((e) => {
      const stay = byId.get(e.nature_stay_id as number);
      if (!stay) return null;
      return {
        id: e.id as number,
        rank: e.rank as number,
        award_label: (e.award_label as string | null) ?? null,
        best_for: (e.best_for as string | null) ?? null,
        editorial_note: (e.editorial_note as string | null) ?? null,
        stay,
      } satisfies StayEntryWithStay;
    })
    .filter((e): e is StayEntryWithStay => e !== null)
    .sort((a, b) => a.rank - b.rank);

  return { guide: guide as StayGuide, entries };
}

export interface StayGuideTeaser {
  topStayName: string | null;
  minPrice: number | null;
  count: number;
}

/** Testvinder + laveste pris pr. guide til hub-kortene (én batch-query). */
export async function getStayGuideTeasers(guideIds: number[]): Promise<Map<number, StayGuideTeaser>> {
  const out = new Map<number, StayGuideTeaser>();
  if (guideIds.length === 0) return out;
  const sb = getServiceClient();
  const { data: entries } = await sb
    .from("stay_guide_entries")
    .select("guide_id, rank, nature_stay_id")
    .in("guide_id", guideIds);
  if (!entries || entries.length === 0) return out;
  const ids = [...new Set(entries.map((e) => e.nature_stay_id as number))];
  const { data: stays } = await sb
    .from("nature_stays")
    .select("id, name, price_from, status")
    .in("id", ids)
    .eq("status", "published");
  const byId = new Map((stays ?? []).map((s) => [s.id as number, s]));
  for (const gid of guideIds) {
    const ge = entries.filter((e) => e.guide_id === gid && byId.has(e.nature_stay_id as number)).sort((a, b) => (a.rank as number) - (b.rank as number));
    const top = ge[0] ? byId.get(ge[0].nature_stay_id as number) : null;
    const prices = ge.map((e) => byId.get(e.nature_stay_id as number)?.price_from).filter((n): n is number => typeof n === "number");
    out.set(gid, { topStayName: (top?.name as string) ?? null, minPrice: prices.length ? Math.min(...prices) : null, count: ge.length });
  }
  return out;
}

/** Slim pins til kortet (Fase 2C) — kun publicerede steder med gyldig location. */
export interface StayPin {
  id: number;
  slug: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  price_from: number | null;
  image_url: string | null;
  booking_url: string | null;
}

export async function getPublishedStayPins(): Promise<StayPin[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("nature_stays")
    .select("id, slug, name, type, location, price_from, image_url, booking_url")
    .eq("status", "published")
    .not("location", "is", null);
  const out: StayPin[] = [];
  for (const s of (data ?? []) as Array<{ id: number; slug: string; name: string; type: string; location: string | null; price_from: number | null; image_url: string | null; booking_url: string | null }>) {
    const m = s.location?.match(/^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (!m) continue;
    out.push({ id: s.id, slug: s.slug, name: s.name, type: s.type, lng: Number(m[1]), lat: Number(m[2]), price_from: s.price_from, image_url: s.image_url, booking_url: s.booking_url });
  }
  return out;
}
