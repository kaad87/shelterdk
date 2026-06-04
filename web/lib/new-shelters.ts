import type { Shelter } from "@/types/shelter";
import { getDisplayImageUrl } from "@shared/lib/shelter-detail";
import { slugifySegment } from "@/lib/slug";
import { NO_KOMMUNE_SLUG } from "@/lib/danmark-silo";
import { createPublicClient } from "@/utils/supabase/server-public";

/** Hvor mange dage et shelter regnes som "nyt" (til "Ny"-badge). */
export const NEW_SHELTER_DAYS = 14;

const DAY_MS = 86_400_000;

/** Kolonner der skal bruges for at vurdere "ny" + "præsentabel" + bygge kort/links. */
const NEW_SHELTERS_SELECT =
  "id, title, slug, description, image_url, image_urls, user_image_urls, google_place_id, google_place_name, google_rating, google_user_ratings_total, region, kommune, place, capacity, booking_url, booking_link_mode, created_at, blur_data_url, geofa_raw, bookable_shelters(id), google_places!shelters_google_place_id_fkey(photo_references)";

/** Er shelteret tilføjet til shelterdk inden for "ny"-vinduet (created_at)? */
export function isNewShelter(shelter: Pick<Shelter, "created_at">, now: number = Date.now()): boolean {
  if (!shelter.created_at) return false;
  const t = new Date(shelter.created_at).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= NEW_SHELTER_DAYS * DAY_MS && now - t >= 0;
}

/** Har shelteret et renderbart Google-foto (via embedded photo_references)? */
function hasGooglePhoto(shelter: Shelter): boolean {
  const places = shelter.google_places;
  const refs = Array.isArray(places) ? places?.[0]?.photo_references : places?.photo_references;
  return Array.isArray(refs) && refs.length > 0;
}

/**
 * Er shelteret "præsentabelt" — dvs. egnet til at fremhæve som nyt?
 * Kræver et renderbart billede (eget eller Google-foto) OG en reel beskrivelse.
 * Beskytter "nye shelters"-flader mod tomme/billedløse imports.
 */
export function isPresentableShelter(shelter: Shelter): boolean {
  const hasImage = getDisplayImageUrl(shelter) !== null || hasGooglePhoto(shelter);
  const desc = (shelter.description ?? "").trim();
  const hasDescription = desc.length >= 20;
  return hasImage && hasDescription;
}

/** Korrekt detalje-URL: region tom/"Danmark" → /shelter/[slug], ellers silo-URL. */
export function newShelterHref(shelter: Pick<Shelter, "slug" | "region" | "kommune">): string {
  const region = (shelter.region ?? "").trim();
  if (!region || region.toLowerCase() === "danmark") return `/shelter/${shelter.slug}`;
  const r = slugifySegment(region);
  const m = shelter.kommune && String(shelter.kommune).trim() ? slugifySegment(String(shelter.kommune)) : NO_KOMMUNE_SLUG;
  return `/danmark/${r}/${m}/${shelter.slug}`;
}

interface GetNewSheltersOpts {
  /** Begræns til shelters tilføjet inden for N dage (udeladt = ingen dato-grænse). */
  sinceDays?: number;
  /** Maks antal returneret. */
  limit: number;
  /** Filtrér til kun præsentable (billede + beskrivelse). Default true. */
  presentableOnly?: boolean;
}

/**
 * Senest tilføjede shelters (created_at desc), ekskl. dubletter.
 * Henter et overskud og filtrerer på "præsentabel", så vi rammer `limit`
 * efter filtrering. Bruges af forside-strip, /nye-side og ugebrev.
 */
export async function getNewShelters(opts: GetNewSheltersOpts): Promise<Shelter[]> {
  const { sinceDays, limit, presentableOnly = true } = opts;
  const supabase = createPublicClient();

  let query = supabase
    .from("shelters")
    .select(NEW_SHELTERS_SELECT)
    .is("duplicate_of_shelter_id", null)
    .not("created_at", "is", null)
    .order("created_at", { ascending: false });

  if (sinceDays && sinceDays > 0) {
    const cutoff = new Date(Date.now() - sinceDays * DAY_MS).toISOString();
    query = query.gte("created_at", cutoff);
  }

  // Overhent når vi filtrerer på præsentabel, så vi kan nå `limit` efter filter.
  query = query.limit(presentableOnly ? Math.max(limit * 5, 100) : limit);

  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as unknown as Shelter[];
  const filtered = presentableOnly ? rows.filter(isPresentableShelter) : rows;
  return filtered.slice(0, limit);
}
