import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords } from "@/lib/shelter-detail";
import { classifyShelterToParks, NATIONAL_PARKS } from "@/lib/national-parks";
import { fetchAllShelterRows } from "@/lib/supabase-pagination";
import { isStructuredBookable } from "@shared/lib/shelter-detail";

const SHELTER_SELECT_LIST =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, booking_link_mode, duplicate_of_shelter_id, region, kommune, place, toilet, water, capacity, display_score, bookable_shelters(id), google_places!shelters_google_place_id_fkey(photo_references)";

const SHELTER_SELECT_WITH_GEOFA =
  SHELTER_SELECT_LIST + ", geofa_raw";

const BOOKABLE_SELECT_LIGHT =
  "id, booking_url, booking_link_mode, region, kommune, bookable_shelters(id)";

async function listStructuredBookableShelters(region?: string): Promise<Shelter[]> {
  try {
    return await fetchAllShelterRows<Shelter>(BOOKABLE_SELECT_LIGHT, (query) => {
      const base = query.is("duplicate_of_shelter_id", null);
      return region ? base.eq("region", region) : base;
    });
  } catch (error) {
    console.error("fakta-db: listStructuredBookableShelters", error);
    return [];
  }
}

async function listStructuredBookablePaidStatusShelters(
  region: string,
  betaling: "Ja" | "Nej"
): Promise<Shelter[]> {
  try {
    return await fetchAllShelterRows<Shelter>(BOOKABLE_SELECT_LIGHT, (query) =>
      query
        .is("duplicate_of_shelter_id", null)
        .eq("region", region)
        .filter("geofa_raw->>betaling", "eq", betaling)
    );
  } catch (error) {
    console.error("fakta-db: listStructuredBookablePaidStatusShelters", error);
    return [];
  }
}

/** Total shelter count (non-duplicate). */
export async function getTotalShelterCount(): Promise<number> {
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("duplicate_of_shelter_id", null);
  if (error) {
    console.error("fakta-db: getTotalShelterCount", error);
    return 0;
  }
  return count ?? 0;
}

/** Shelter count per region. Returns sorted array of { region, count }. */
export async function getCountPerRegion(): Promise<
  { region: string; count: number }[]
> {
  let data: { region: string }[];
  try {
    data = await fetchAllShelterRows<{ region: string }>("region", (query) =>
      query.not("region", "is", null).neq("region", "").neq("region", "Danmark")
    );
  } catch (error) {
    console.error("fakta-db: getCountPerRegion", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const r = (row.region || "").trim();
    if (!r) continue;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

export interface FacilityCounts {
  toilet: number;
  water: number;
  baalplads: number;
  hund: number;
  strand: number;
  bruser: number;
  bookbar: number;
  gratis: number;
  handicap: number;
}

/** Count shelters for each facility type. */
export async function getFacilityCounts(): Promise<FacilityCounts> {
  const supabase = createPublicClient();
  const base = () =>
    supabase
      .from("shelters")
      .select("id", { count: "exact", head: true })
      .is("duplicate_of_shelter_id", null);

  const [toilet, water, baalplads, hund, strand, bruser, gratis, handicap, bookableShelters] =
    await Promise.all([
      base().in("toilet", ["flush", "mulch"]),
      base().eq("water", true),
      base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
      base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
      base().filter("geofa_raw->>strand_naerhed", "ilike", "%ja%"),
      base().filter("geofa_raw->>bruser_bad", "ilike", "%ja%"),
      base().filter("geofa_raw->>betaling", "eq", "Nej"),
      base().or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"),
      listStructuredBookableShelters(),
    ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookableShelters.filter((shelter) => isStructuredBookable(shelter)).length,
    gratis: gratis.count ?? 0,
    handicap: handicap.count ?? 0,
  };
}

/** Facility counts scoped to a single region. */
export async function getFacilityCountsForRegion(
  region: string
): Promise<FacilityCounts> {
  const supabase = createPublicClient();
  const base = () =>
    supabase
      .from("shelters")
      .select("id", { count: "exact", head: true })
      .is("duplicate_of_shelter_id", null)
      .eq("region", region);

  const [toilet, water, baalplads, hund, strand, bruser, gratis, handicap, bookableShelters] =
    await Promise.all([
      base().in("toilet", ["flush", "mulch"]),
      base().eq("water", true),
      base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
      base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
      base().filter("geofa_raw->>strand_naerhed", "ilike", "%ja%"),
      base().filter("geofa_raw->>bruser_bad", "ilike", "%ja%"),
      base().filter("geofa_raw->>betaling", "eq", "Nej"),
      base().or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"),
      listStructuredBookableShelters(region),
    ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookableShelters.filter((shelter) => isStructuredBookable(shelter)).length,
    gratis: gratis.count ?? 0,
    handicap: handicap.count ?? 0,
  };
}

/** Top-N shelters by Google rating (with minimum review count). */
export async function getTopRatedShelters(
  limit: number = 10,
  minReviews: number = 3
): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .not("google_rating", "is", null)
    .gte("google_user_ratings_total", minReviews)
    .order("google_rating", { ascending: false })
    .order("google_user_ratings_total", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fakta-db: getTopRatedShelters", error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Average Google rating across all shelters with a rating. */
export async function getAverageRating(): Promise<number | null> {
  let data: { google_rating: number }[];
  try {
    data = await fetchAllShelterRows<{ google_rating: number }>("google_rating", (query) =>
      query.not("google_rating", "is", null)
    );
  } catch {
    return null;
  }
  if (data.length === 0) return null;
  const ratings = data.map(
    (r) => r.google_rating
  );
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return Math.round(avg * 10) / 10;
}

/** Count of free (gratis) shelters for a filter+region combo. */
export async function getFreeCountForFilterRegion(
  filterKey: string,
  region: string
): Promise<number> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .filter("geofa_raw->>betaling", "eq", "Nej");

  switch (filterKey) {
    case "toilet":
      query = query.in("toilet", ["flush", "mulch"]);
      break;
    case "vand":
      query = query.eq("water", true);
      break;
    case "baalplads":
      query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
      break;
    case "hund":
      query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
      break;
    case "strand":
      query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
      break;
    case "booking":
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"
      );
      break;
    default:
      return 0;
  }

  if (filterKey === "booking") {
    const shelters = await listStructuredBookablePaidStatusShelters(region, "Nej");
    return shelters.filter((shelter) => isStructuredBookable(shelter)).length;
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/** Count of shelters per filter for a given region. Used to check 5-shelter threshold. */
export async function getFilterRegionCount(
  filterKey: string,
  region: string
): Promise<number> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("duplicate_of_shelter_id", null)
    .eq("region", region);

  switch (filterKey) {
    case "toilet":
      query = query.in("toilet", ["flush", "mulch"]);
      break;
    case "vand":
      query = query.eq("water", true);
      break;
    case "baalplads":
      query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
      break;
    case "hund":
      query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
      break;
    case "strand":
      query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
      break;
    case "booking":
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"
      );
      break;
    default:
      return 0;
  }

  if (filterKey === "booking") {
    const shelters = await listStructuredBookableShelters(region);
    return shelters.filter((shelter) => isStructuredBookable(shelter)).length;
  }

  const { count, error } = await query;
  if (error) {
    console.error(
      `fakta-db: getFilterRegionCount(${filterKey}, ${region})`,
      error
    );
    return 0;
  }
  return count ?? 0;
}

/** Shelters matching a filter + region combo. Used by cross pages. */
export async function getSheltersForFilterRegion(
  filterKey: string,
  region: string,
  limit: number = 50
): Promise<Shelter[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);

  switch (filterKey) {
    case "toilet":
      query = query.in("toilet", ["flush", "mulch"]);
      break;
    case "vand":
      query = query.eq("water", true);
      break;
    case "baalplads":
      query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
      break;
    case "hund":
      query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
      break;
    case "strand":
      query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
      break;
    case "booking":
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"
      );
      break;
    default:
      return [];
  }

  if (filterKey === "booking") {
    const shelters = await fetchAllShelterRows<Shelter>(SHELTER_SELECT_LIST, (baseQuery) =>
      baseQuery
        .is("duplicate_of_shelter_id", null)
        .eq("region", region)
        .order("display_score", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true })
    );
    return shelters.filter((shelter) => isStructuredBookable(shelter)).slice(0, limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`fakta-db: getSheltersForFilterRegion`, error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Shelters near beach / water nationally. */
export async function getStrandShelters(limit: number = 50): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .filter("geofa_raw->>strand_naerhed", "ilike", "%ja%")
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("fakta-db: getStrandShelters", error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Family-friendly shelters: capacity >= 4, toilet, water. */
export async function getFamilyShelters(limit: number = 50): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .gte("capacity", 4)
    .in("toilet", ["flush", "mulch"])
    .eq("water", true)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("fakta-db: getFamilyShelters", error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Handicap-accessible shelters nationally. */
export async function getHandicapShelters(limit: number = 50): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet")
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("fakta-db: getHandicapShelters", error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Shelters in national parks. Returns { parkName, shelters[] }. */
export async function getSheltersInNationalParks(): Promise<
  { parkName: string; parkSlug: string; shelters: Shelter[] }[]
> {
  // Step 1: lightweight query to classify shelters by coords
  let locationData: { id: string; location: string }[];
  try {
    locationData = await fetchAllShelterRows<{ id: string; location: string }>(
      "id, location",
      (query) => query.not("location", "is", null)
    );
  } catch {
    return [];
  }

  const parkShelterIds = new Map<string, Set<string>>();
  for (const park of NATIONAL_PARKS) {
    parkShelterIds.set(park.name, new Set());
  }

  const allParkIds = new Set<string>();
  for (const row of locationData) {
    const coords = getLocationCoords(row as unknown as Shelter);
    if (!coords) continue;
    const parks = classifyShelterToParks(coords.lat, coords.lon);
    for (const parkName of parks) {
      parkShelterIds.get(parkName)?.add(row.id);
      allParkIds.add(row.id);
    }
  }

  if (allParkIds.size === 0) {
    return NATIONAL_PARKS.map((park) => ({
      parkName: park.name,
      parkSlug: park.slug,
      shelters: [],
    }));
  }

  const supabase = createPublicClient();
  // Step 2: fetch full data only for shelters that are in a park
  let fullData: Shelter[];
  try {
    fullData = await fetchAllShelterRows<Shelter>(SHELTER_SELECT_LIST, (query) =>
      query.in("id", Array.from(allParkIds))
    );
  } catch {
    return [];
  }

  const shelterById = new Map<string, Shelter>();
  for (const s of fullData) {
    shelterById.set(s.id, s);
  }

  return NATIONAL_PARKS.map((park) => ({
    parkName: park.name,
    parkSlug: park.slug,
    shelters: Array.from(parkShelterIds.get(park.name) ?? [])
      .map((id) => shelterById.get(id))
      .filter((s): s is Shelter => s != null),
  }));
}

/** Kommune breakdown for a filter+region combo. Uses lightweight query. */
export async function getKommuneBreakdownForFilterRegion(
  filterKey: string,
  region: string
): Promise<{ kommune: string; count: number }[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select("kommune")
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .limit(1000);

  switch (filterKey) {
    case "toilet":
      query = query.in("toilet", ["flush", "mulch"]);
      break;
    case "vand":
      query = query.eq("water", true);
      break;
    case "baalplads":
      query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
      break;
    case "hund":
      query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
      break;
    case "strand":
      query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
      break;
    case "booking":
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet"
      );
      break;
    default:
      return [];
  }

  if (filterKey === "booking") {
    const shelters = await listStructuredBookableShelters(region);
    const counts = new Map<string, number>();
    for (const shelter of shelters) {
      if (!isStructuredBookable(shelter)) continue;
      const kommune = (shelter.kommune || "Ukendt").trim();
      counts.set(kommune, (counts.get(kommune) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([kommune, count]) => ({ kommune, count }))
      .sort((a, b) => b.count - a.count);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { kommune: string | null }[]) {
    const k = (row.kommune || "Ukendt").trim();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kommune, count]) => ({ kommune, count }))
    .sort((a, b) => b.count - a.count);
}
