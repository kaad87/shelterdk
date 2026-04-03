import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords } from "@/lib/shelter-detail";
import { classifyShelterToParks, NATIONAL_PARKS } from "@/lib/national-parks";

const SHELTER_SELECT_LIST =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, water, capacity, display_score, google_places!shelters_google_place_id_fkey(photo_references)";

const SHELTER_SELECT_WITH_GEOFA =
  SHELTER_SELECT_LIST + ", geofa_raw";

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
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region")
    .is("duplicate_of_shelter_id", null)
    .not("region", "is", null)
    .neq("region", "")
    .neq("region", "Danmark");
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { region: string }[]) {
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

  const [toilet, water, baalplads, hund, strand, bruser, bookbar, gratis, handicap] =
    await Promise.all([
      base().in("toilet", ["flush", "mulch"]),
      base().eq("water", true),
      base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
      base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
      base().filter("geofa_raw->>strand_naerhed", "eq", "Ja"),
      base().filter("geofa_raw->>bruser_bad", "eq", "Ja"),
      base().not("booking_url", "is", null).neq("booking_url", ""),
      base().filter("geofa_raw->>betaling", "eq", "Nej"),
      base().or("geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"),
    ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookbar.count ?? 0,
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

  const [toilet, water, baalplads, hund, strand, bruser, bookbar, gratis, handicap] =
    await Promise.all([
      base().in("toilet", ["flush", "mulch"]),
      base().eq("water", true),
      base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
      base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
      base().filter("geofa_raw->>strand_naerhed", "eq", "Ja"),
      base().filter("geofa_raw->>bruser_bad", "eq", "Ja"),
      base().not("booking_url", "is", null).neq("booking_url", ""),
      base().filter("geofa_raw->>betaling", "eq", "Nej"),
      base().or("geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"),
    ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookbar.count ?? 0,
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
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("google_rating")
    .is("duplicate_of_shelter_id", null)
    .not("google_rating", "is", null);
  if (error || !data || data.length === 0) return null;
  const ratings = (data as { google_rating: number }[]).map(
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
      query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja");
      break;
    case "booking":
      query = query.not("booking_url", "is", null).neq("booking_url", "");
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"
      );
      break;
    default:
      return 0;
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
      query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja");
      break;
    case "booking":
      query = query.not("booking_url", "is", null).neq("booking_url", "");
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"
      );
      break;
    default:
      return 0;
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
  limit: number = 200
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
      query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja");
      break;
    case "booking":
      query = query.not("booking_url", "is", null).neq("booking_url", "");
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"
      );
      break;
    default:
      return [];
  }

  const { data, error } = await query;
  if (error) {
    console.error(`fakta-db: getSheltersForFilterRegion`, error);
    return [];
  }
  return (data as Shelter[]) ?? [];
}

/** Shelters near beach / water nationally. */
export async function getStrandShelters(limit: number = 200): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .filter("geofa_raw->>strand_naerhed", "eq", "Ja")
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
export async function getFamilyShelters(limit: number = 200): Promise<Shelter[]> {
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
export async function getHandicapShelters(limit: number = 200): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .is("duplicate_of_shelter_id", null)
    .or("geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet")
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
  const supabase = createPublicClient();

  // Step 1: lightweight query to classify shelters by coords
  const { data: locationData, error: locError } = await supabase
    .from("shelters")
    .select("id, location")
    .is("duplicate_of_shelter_id", null)
    .not("location", "is", null);
  if (locError || !locationData) return [];

  const parkShelterIds = new Map<string, Set<number>>();
  for (const park of NATIONAL_PARKS) {
    parkShelterIds.set(park.name, new Set());
  }

  const allParkIds = new Set<number>();
  for (const row of locationData as { id: number; location: string }[]) {
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

  // Step 2: fetch full data only for shelters that are in a park
  const { data: fullData, error: fullError } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_LIST)
    .in("id", Array.from(allParkIds));
  if (fullError || !fullData) return [];

  const shelterById = new Map<number, Shelter>();
  for (const s of fullData as Shelter[]) {
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
      query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja");
      break;
    case "bruser":
      query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja");
      break;
    case "booking":
      query = query.not("booking_url", "is", null).neq("booking_url", "");
      break;
    case "handicap":
      query = query.or(
        "geofa_raw->>handicap.eq.Handicapegnet,geofa_raw->>handicap.eq.Delvist handicapegnet"
      );
      break;
    default:
      return [];
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
