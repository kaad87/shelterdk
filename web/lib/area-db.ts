import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
export { prepositionForArea, prepositionForRegionName } from "@shared/lib/area-prepositions";

export interface Area {
  slug: string;
  name: string;
  description: string | null;
  region: string;
  /**
   * Landsdels-områder (fx Sønderjylland) defineres ved kommuner i stedet for
   * area_slug: area_slug er én-værdi pr. shelter og allerede brugt af
   * overlappende områder (Vadehavet, Hærvejen). Null/tom → area_slug-opslag.
   */
  kommuner?: string[] | null;
}

export type AreaFilterSource = Pick<Area, "slug" | "kommuner">;

/** Filtrerer en shelters-query til områdets pladser — kommune-liste eller area_slug. */
/**
 * Hvilket filter et områdes shelters findes med. Returneres som data (ikke som
 * builder-mutation) fordi supabase-js' generics bliver "excessively deep" når
 * builderen sendes gennem en generisk funktion.
 */
export function areaShelterFilter(
  area: AreaFilterSource
): { column: "kommune"; op: "in"; value: string[] } | { column: "area_slug"; op: "eq"; value: string } {
  if (area.kommuner && area.kommuner.length > 0) return { column: "kommune", op: "in", value: area.kommuner };
  return { column: "area_slug", op: "eq", value: area.slug };
}

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, booking_url, booking_link_mode, duplicate_of_shelter_id, region, kommune, place, water, display_score, featured_sort_boost, bookable_shelters(id), blur_data_url";
const EMBED_SHELTER_LIMIT = 500;

/** Hent alle områder (sorteret efter navn). */
export async function getAllAreas(): Promise<Area[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("slug, name, description, region, kommuner")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as Area[];
}

/** PostgREST-koden for .single() uden raekker: omraadet findes ikke. */
const INGEN_RAEKKE = "PGRST116";

/**
 * Koerer et Supabase-opslag igen én gang, hvis det fejler. Et lokalt build
 * 19/11 2026 fik ECONNRESET paa enkelte af ~3.700 sider; ét nyt forsoeg efter
 * et halvt sekund er nok til den slags hik og koster intet, naar alt virker.
 */
async function medEtNytForsoeg<T extends { error: { code?: string } | null }>(
  opslag: () => PromiseLike<T>,
  ok: (r: T) => boolean = (r) => !r.error
): Promise<T> {
  const foerste = await opslag();
  if (ok(foerste)) return foerste;
  await new Promise((r) => setTimeout(r, 500));
  return opslag();
}

// Områder er ~statisk redaktionelt indhold (navn/beskrivelse) → cachet 24t for at
// fjerne ~444k pr-render-opslag uden mærkbar staleness.
//
// En fejl KASTES i stedet for at blive til null. unstable_cache gemmer et
// null-resultat i 24 timer, og omraadesiden laver null om til notFound(). Et
// enkelt netvaerksudfald mod Supabase gjorde saaledes en omraadeside til en
// 404 i et doegn (maalt i et lokalt build 19/11 2026: 19 af 19 omraadesider).
// En kastet fejl caches ikke, og ISR beholder den sidste gode side.
const cachedAreaBySlug = unstable_cache(
  async (slug: string): Promise<Area | null> => {
    const supabase = createPublicClient();
    const { data, error } = await medEtNytForsoeg(
      () =>
        supabase
          .from("areas")
          .select("slug, name, description, region, kommuner")
          .eq("slug", slug)
          .single(),
      (r) => !r.error || r.error.code === INGEN_RAEKKE
    );
    if (error) {
      if (error.code === INGEN_RAEKKE) return null;
      throw new Error(`areas-opslag for ${slug} fejlede: ${error.message}`);
    }
    return (data as Area) ?? null;
  },
  ["get-area-by-slug"],
  { revalidate: 86400 }
);

/**
 * Hent område efter slug. Null hvis det ikke findes. Cachet 24t.
 *
 * KASTER ved netvaerks- og databasefejl, saa en side, der er bygget paa
 * omraadet, ikke bliver til en 404. Brug getAreaBySlugEllerNull, hvor
 * omraadet kun er ekstra information (shelter-siden, /soeg).
 */
export async function getAreaBySlug(slug: string): Promise<Area | null> {
  return cachedAreaBySlug(slug);
}

/** Som getAreaBySlug, men en fejl giver null. Til sider, hvor omraadet er en bisag. */
export async function getAreaBySlugEllerNull(slug: string): Promise<Area | null> {
  return getAreaBySlug(slug).catch(() => null);
}

/** Antal shelters i et område (area_slug, ekskl. dubletter). */
export async function getShelterCountByAreaSlug(areaSlug: string): Promise<number> {
  const supabase = createPublicClient();
  const area = (await getAreaBySlug(areaSlug)) ?? { slug: areaSlug, kommuner: null };
  const f = areaShelterFilter(area);
  const base = supabase.from("shelters").select("id", { count: "exact", head: true }).is("duplicate_of_shelter_id", null);
  const { count, error } = await (f.op === "in" ? base.in(f.column, f.value) : base.eq(f.column, f.value));
  if (error) return 0;
  return count ?? 0;
}

/** Hent alle shelters i et område (til embed-kort). ISR/cache. */
export async function getSheltersByAreaSlug(areaSlug: string): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const area = (await getAreaBySlug(areaSlug)) ?? { slug: areaSlug, kommuner: null };
  const f = areaShelterFilter(area);
  // Bygges forfra i hvert forsoeg: supabase-js' filtermetoder aendrer selve
  // builderen, saa et genbrugt objekt ville faa filteret paa to gange.
  const byg = () => {
    const base = supabase
      .from("shelters")
      .select(SHELTER_SELECT)
      .is("duplicate_of_shelter_id", null)
      .order("featured_sort_boost", { ascending: false, nullsFirst: false })
      .order("display_score", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .limit(EMBED_SHELTER_LIMIT);
    return f.op === "in" ? base.in(f.column, f.value) : base.eq(f.column, f.value);
  };
  const { data, error } = await medEtNytForsoeg(byg);
  // Kastes af samme grund som i cachedAreaBySlug: en tom liste ville give en
  // omraadeside med 0 pladser og noindex, som ISR saa holder paa et doegn.
  if (error) throw new Error(`shelters for omraadet ${areaSlug} fejlede: ${error.message}`);
  return (data ?? []) as Shelter[];
}
