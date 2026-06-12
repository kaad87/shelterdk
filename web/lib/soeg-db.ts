import { createPublicClient } from "@/utils/supabase/server-public";
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords, getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";
import { isStructuredBookable } from "@shared/lib/shelter-detail";
import { findPostnummerSuggestions } from "@/lib/postnummer";
import { haversineKm } from "@/lib/haversine";
import { SEARCH_SYNONYMS } from "@/lib/search-synonyms";
import { expandDanishVariants } from "@/lib/search-normalize";

/** Sorter shelters: featured boost først, derefter billede, derefter score, derefter titel. */
function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aBoost = a.featured_sort_boost ?? 0;
  const bBoost = b.featured_sort_boost ?? 0;
  if (bBoost !== aBoost) return bBoost - aBoost;
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff = (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, booking_link_mode, duplicate_of_shelter_id, region, kommune, place, water, toilet, capacity, display_score, featured_sort_boost, bookable_shelters(id), google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, booking_link_mode, duplicate_of_shelter_id, region, water, google_places!shelters_google_place_id_fkey(photo_references), blur_data_url";

export const SOEG_PAGE_SIZE = 24;
const BOOKBAR_FETCH_LIMIT = 5000;

export interface SoegPageResult {
  shelters: Shelter[];
  hasMore: boolean;
  availabilityMap?: Record<string, "available" | "booked" | "partial">;
}

export interface SoegFilters {
  anmeldelser?: boolean;
  bookbar?: boolean;
  vand?: boolean;
  toilet?: boolean;
  hund?: boolean;
  baalplads?: boolean;
  gratis?: boolean;
  handicap?: boolean;
  bord_baenk?: boolean;
  strand?: boolean;
  bruser?: boolean;
  min_pladser?: number;
  /** ISO-dato "YYYY-MM-DD" — ankomstdato: filtrer bekræftet optagne shelters fra. */
  date?: string;
  /** ISO-dato "YYYY-MM-DD" — afrejsedato: kombineret med date giver det et interval. */
  date_to?: string;
  /** Vis KUN shelters med bekræftet ledighedsdata (NST + ShelterDK booking) der ikke er optaget i perioden. */
  confirmed_available?: boolean;
}

/** Bounding box for kortvisning – hent shelters inden for det synlige område. */
export interface MapBbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const BBOX_FETCH_LIMIT = 2000;
const PLACE_OUTLIER_MIN_CLUSTER_SIZE = 4;
const PLACE_OUTLIER_CLUSTER_RADIUS_KM = 50;
const PLACE_OUTLIER_MAX_DISTANCE_KM = 90;

function normalizeGeoSearchTerm(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("da-DK");
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function matchesExactPlaceOnly(shelter: Shelter, term: string): boolean {
  if (!term) return false;
  const place = normalizeGeoSearchTerm(shelter.place);
  if (place !== term) return false;

  const kommune = normalizeGeoSearchTerm(shelter.kommune);
  const region = normalizeGeoSearchTerm(shelter.region);
  const title = normalizeGeoSearchTerm(shelter.title);

  return kommune !== term && region !== term && !title.includes(term);
}

function matchesSearchAnchor(shelter: Shelter, term: string): boolean {
  if (!term) return false;
  const place = normalizeGeoSearchTerm(shelter.place);
  const kommune = normalizeGeoSearchTerm(shelter.kommune);
  const title = normalizeGeoSearchTerm(shelter.title);
  return place === term || kommune === term || title.includes(term);
}

export function prunePlaceOutliersForExactQuery(
  shelters: Shelter[],
  q: string | null
): Shelter[] {
  const term = normalizeGeoSearchTerm(q);
  if (!term || shelters.length < PLACE_OUTLIER_MIN_CLUSTER_SIZE) return shelters;

  const anchors = shelters
    .filter((shelter) => matchesSearchAnchor(shelter, term))
    .map((shelter) => ({ shelter, coords: getLocationCoords(shelter) }))
    .filter((row): row is { shelter: Shelter; coords: { lat: number; lon: number } } => Boolean(row.coords));

  if (anchors.length < PLACE_OUTLIER_MIN_CLUSTER_SIZE) return shelters;

  const medianLat = median(anchors.map((row) => row.coords.lat));
  const medianLon = median(anchors.map((row) => row.coords.lon));
  const closeAnchorCount = anchors.filter((row) => (
    haversineKm(medianLat, medianLon, row.coords.lat, row.coords.lon) <= PLACE_OUTLIER_CLUSTER_RADIUS_KM
  )).length;

  if (closeAnchorCount < Math.ceil(anchors.length * 0.6)) return shelters;

  return shelters.filter((shelter) => {
    if (!matchesExactPlaceOnly(shelter, term)) return true;
    const coords = getLocationCoords(shelter);
    if (!coords) return true;
    return haversineKm(medianLat, medianLon, coords.lat, coords.lon) <= PLACE_OUTLIER_MAX_DISTANCE_KM;
  });
}

type AvailabilityState = "available" | "booked" | "partial";

/**
 * Aggregér bookede units op til plads-niveau.
 *
 * En plads (shelters.id) kan have flere individuelle shelters (units i
 * bookable_shelters). Pladsen er kun "booked" hvis ALLE dens units er bookede;
 * er kun nogle bookede, er pladsen "partial" (stadig ledig). Pladser uden
 * bookede units optræder ikke i resultatet.
 *
 * @param unitRows  ALLE units for de berørte pladser ({shelter_id, id})
 * @param bookedUnitIds  id'er på de units der er bookede i perioden
 */
export function aggregateUnitAvailability(
  unitRows: { shelter_id: string | null; id: string }[],
  bookedUnitIds: Set<string>
): Map<string, "booked" | "partial"> {
  const totalPerShelter = new Map<string, number>();
  const bookedPerShelter = new Map<string, number>();
  for (const row of unitRows) {
    if (!row.shelter_id) continue;
    totalPerShelter.set(row.shelter_id, (totalPerShelter.get(row.shelter_id) ?? 0) + 1);
    if (bookedUnitIds.has(row.id)) {
      bookedPerShelter.set(row.shelter_id, (bookedPerShelter.get(row.shelter_id) ?? 0) + 1);
    }
  }
  const result = new Map<string, "booked" | "partial">();
  for (const [shelterId, total] of totalPerShelter) {
    const booked = bookedPerShelter.get(shelterId) ?? 0;
    if (booked === 0) continue;
    result.set(shelterId, booked >= total ? "booked" : "partial");
  }
  return result;
}

async function getDateAvailabilityData(
  date: string,
  dateTo?: string,
  fetchTrackedIds?: boolean
): Promise<{ bookedIds: string[]; availabilityMap: Record<string, AvailabilityState>; trackedIds?: string[] }> {
  const admin = createAdminClient();
  const availabilityMap: Record<string, AvailabilityState> = {};
  const bookedIdSet = new Set<string>();
  const effectiveDateTo = dateTo && dateTo >= date ? dateTo : date;

  // External providers (NST m.fl.) — kræver admin client (RLS)
  const { data: extDays } = await admin
    .from("external_availability_days")
    .select("shelter_id, state")
    .gte("day", date)
    .lte("day", effectiveDateTo);

  for (const row of (extDays ?? []) as { shelter_id: string; state: string }[]) {
    const s = row.state;
    if (s === "booked" || s === "confirmed" || s === "blocked") {
      availabilityMap[row.shelter_id] = "booked";
      bookedIdSet.add(row.shelter_id);
    } else if (s === "partial" || s === "pending") {
      if (!availabilityMap[row.shelter_id]) availabilityMap[row.shelter_id] = "partial";
    } else if (s === "available") {
      if (!availabilityMap[row.shelter_id]) availabilityMap[row.shelter_id] = "available";
    }
  }

  // Interne ShelterDK-bookinger
  // For single-day search (effectiveDateTo === date) the overlap condition check_in < date
  // misses same-day check-ins (e.g. check_in = date). We advance the upper bound by 1 day
  // so that check_in <= date is equivalent to check_in < date+1.
  const checkInUpperBound = (() => {
    if (effectiveDateTo === date) {
      const d = new Date(date + "T12:00:00");
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return effectiveDateTo;
  })();
  const { data: bookings } = await admin
    .from("shelter_bookings")
    .select("bookable_shelter_id")
    // Any overlap with the requested stay should mark the shelter as unavailable.
    .lt("check_in", checkInUpperBound)
    .gt("check_out", date)
    .in("status", ["confirmed", "pending"]);

  // Hent alle bookable_shelters IDs (bruges til både booked-check og tracked-set)
  const { data: allBookableShelters } = fetchTrackedIds
    ? await admin.from("bookable_shelters").select("shelter_id, id")
    : { data: null };

  const bookedUnitIds = new Set(
    ((bookings ?? []) as { bookable_shelter_id: string }[]).map((b) => b.bookable_shelter_id)
  );

  if (bookedUnitIds.size > 0) {
    // En plads kan bestå af flere individuelle shelters (units) under samme
    // shelters.id. Pladsen er kun OPTAGET hvis ALLE dens units er bookede i
    // perioden — er kun nogle bookede, er pladsen stadig ledig (delvist).
    // Vi skal derfor kende ALLE units pr. berørt plads, ikke kun de bookede.
    let unitRows: { shelter_id: string | null; id: string }[];
    if (fetchTrackedIds) {
      unitRows = (allBookableShelters ?? []) as { shelter_id: string | null; id: string }[];
    } else {
      const { data: bookedUnitShelters } = await admin
        .from("bookable_shelters")
        .select("shelter_id")
        .in("id", [...bookedUnitIds]);
      const affectedShelterIds = [
        ...new Set(
          ((bookedUnitShelters ?? []) as { shelter_id: string | null }[])
            .map((r) => r.shelter_id)
            .filter((v): v is string => Boolean(v))
        ),
      ];
      unitRows = affectedShelterIds.length
        ? (((
            await admin
              .from("bookable_shelters")
              .select("shelter_id, id")
              .in("shelter_id", affectedShelterIds)
          ).data) ?? []) as { shelter_id: string | null; id: string }[]
        : [];
    }

    for (const [shelterId, state] of aggregateUnitAvailability(unitRows, bookedUnitIds)) {
      if (state === "booked") {
        if (!bookedIdSet.has(shelterId)) {
          availabilityMap[shelterId] = "booked";
          bookedIdSet.add(shelterId);
        }
      } else if (!bookedIdSet.has(shelterId) && !availabilityMap[shelterId]) {
        // Delvist booket → pladsen er stadig ledig; markér "partial".
        availabilityMap[shelterId] = "partial";
      }
    }
  }

  if (!fetchTrackedIds) {
    return { bookedIds: [...bookedIdSet], availabilityMap };
  }

  // Hent alle shelter IDs med ledighedsdata: NST + ShelterDK bookable
  const [{ data: nstShelters }] = await Promise.all([
    admin.from("shelters").select("id").not("availability_provider", "is", null).is("duplicate_of_shelter_id", null),
  ]);

  const trackedIdSet = new Set<string>();
  for (const row of (nstShelters ?? []) as { id: string }[]) trackedIdSet.add(row.id);
  for (const row of (allBookableShelters ?? []) as { shelter_id: string | null }[]) {
    if (row.shelter_id) trackedIdSet.add(row.shelter_id);
  }

  return { bookedIds: [...bookedIdSet], availabilityMap, trackedIds: [...trackedIdSet] };
}

function sliceBookableResults(
  shelters: Shelter[],
  page: number,
  pageSize: number
): { shelters: Shelter[]; hasMore: boolean } {
  const filtered = shelters.filter((shelter) => isStructuredBookable(shelter));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  return {
    shelters: filtered.slice(from, to),
    hasMore: filtered.length > to,
  };
}

/**
 * Hent én side shelters med valgfri region, søgetekst, area_slug, filtre og bbox.
 * Ved bbox hentes op til BBOX_FETCH_LIMIT og filtreres efter koordinater (location).
 */
export type SoegSort = "standard" | "rating" | "reviews";

export async function getSheltersPage(
  region: string | null,
  q: string | null,
  page: number,
  pageSize: number = SOEG_PAGE_SIZE,
  filters?: SoegFilters | null,
  bbox?: MapBbox | null,
  areaSlug?: string | null,
  sort?: SoegSort | null
): Promise<SoegPageResult> {
  const supabase = createPublicClient();
  const bookbarFilterActive = Boolean(filters?.bookbar);
  const useBbox = bbox && [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon].every((n) => Number.isFinite(n));
  const from = useBbox || bookbarFilterActive ? 0 : (page - 1) * pageSize;
  const bulkFetchLimit = useBbox
    ? BBOX_FETCH_LIMIT
    : bookbarFilterActive
      ? BOOKBAR_FETCH_LIMIT
      : 0;
  const toInclusive = bulkFetchLimit > 0 ? bulkFetchLimit - 1 : from + pageSize - 1;

  const isValidDate = (d?: string): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (filters?.confirmed_available && !isValidDate(filters.date)) {
    return { shelters: [], hasMore: false, availabilityMap: {} };
  }
  const needTrackedIds = Boolean(filters?.confirmed_available);
  let dateAvailability: { bookedIds: string[]; availabilityMap: Record<string, AvailabilityState>; trackedIds?: string[] } | null = null;
  if (isValidDate(filters?.date)) {
    dateAvailability = await getDateAvailabilityData(filters.date, filters.date_to, needTrackedIds);
  }

  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null);

  // Apply sort order
  if (sort === "rating") {
    query = query
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  } else if (sort === "reviews") {
    query = query
      .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  } else {
    query = query
      .order("featured_sort_boost", { ascending: false, nullsFirst: false })
      .order("display_score", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true });
  }

  if (region && region.trim()) {
    query = query.eq("region", region.trim());
  }
  if (areaSlug && areaSlug.trim()) {
    query = query.eq("area_slug", areaSlug.trim());
  }
  if (q && q.trim()) {
    const term = q.trim().replace(/"/g, '""');

    {
      // Expand til alle plausible danske staver (Aarhus/Århus, kobenhavn/
      // København etc.) så ilike fanger uanset om brugeren har æøå med.
      const variants = expandDanishVariants(term);
      const patternFor = (v: string) => `"%${v.replace(/"/g, '""')}%"`;

      // Find area_slugs der matcher søgetermen (fx "Nationalpark Thy" → "nationalpark-thy").
      // Slår op med ALLE varianter så "soenderjylland" også finder areas-navne
      // skrevet med ø.
      const areaResults = await Promise.all(
        variants.map((v) =>
          supabase
            .from("areas")
            .select("slug")
            .ilike("name", `%${v}%`)
            .limit(5)
        )
      );
      const matchingAreaSlugs = new Set<string>();
      for (const res of areaResults) {
        for (const a of (res.data as { slug: string }[]) ?? []) {
          if (a.slug) matchingAreaSlugs.add(a.slug);
        }
      }

      const orPartsArr: string[] = [];
      for (const v of variants) {
        const p = patternFor(v);
        orPartsArr.push(`title.ilike.${p}`, `region.ilike.${p}`, `kommune.ilike.${p}`, `place.ilike.${p}`);
      }
      for (const slug of matchingAreaSlugs) {
        orPartsArr.push(`area_slug.eq.${slug}`);
      }

      // Geografiske synonymer: fx "Sønderjylland" → kommuner i det område.
      // Slår op på hver variant så "soenderjylland" også triggerer mapping.
      for (const v of variants) {
        const synonymKommuner = SEARCH_SYNONYMS[v];
        if (synonymKommuner) {
          for (const k of synonymKommuner) {
            orPartsArr.push(`kommune.eq.${k}`);
          }
        }
      }

      query = query.or(orPartsArr.join(","));
    }
  }
  if (filters?.anmeldelser) {
    query = query.not("google_user_ratings_total", "is", null).gt("google_user_ratings_total", 0);
  }
  if (filters?.vand) {
    query = query.eq("water", true);
  }
  if (filters?.toilet) {
    query = query.in("toilet", ["flush", "mulch"]);
  }
  if (filters?.hund) {
    query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
  }
  if (filters?.baalplads) {
    query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
  }
  if (filters?.gratis) {
    query = query.filter("geofa_raw->>betaling", "eq", "Nej");
  }
  if (filters?.handicap) {
    query = query.or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet");
  }
  if (filters?.bord_baenk) {
    query = query.filter("geofa_raw->>bord_baenk", "ilike", "%ja%");
  }
  if (filters?.strand) {
    query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
  }
  if (filters?.bruser) {
    query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
  }
  if (filters?.min_pladser && filters.min_pladser > 0) {
    query = query.gte("capacity", filters.min_pladser);
  }
  if (filters?.confirmed_available && dateAvailability?.trackedIds) {
    // Vis KUN shelters med bekræftet ledighedsdata der ikke er optaget i perioden
    const bookedSet = new Set(dateAvailability.bookedIds);
    const availableIds = dateAvailability.trackedIds.filter((id) => !bookedSet.has(id));
    if (availableIds.length === 0) {
      return { shelters: [], hasMore: false, availabilityMap: dateAvailability.availabilityMap };
    }
    query = query.in("id", availableIds);
  } else if (dateAvailability && dateAvailability.bookedIds.length > 0) {
    query = query.not("id", "in", `(${dateAvailability.bookedIds.join(",")})`);
  }

  let { data, error } = await query.range(from, toInclusive);

  if (!error && data && useBbox && bbox) {
    let list: Shelter[] = [];
    for (const row of data as Shelter[]) {
      const coords = getLocationCoords(row);
      if (!coords) continue;
      if (
        coords.lat >= bbox.minLat &&
        coords.lat <= bbox.maxLat &&
        coords.lon >= bbox.minLon &&
        coords.lon <= bbox.maxLon
      ) {
        list.push(row);
      }
    }
    if (bookbarFilterActive) {
      list = list.filter((s) => isStructuredBookable(s));
    }
    list.sort(sortByImageAndScore);
    return { shelters: list, hasMore: false, ...(dateAvailability ? { availabilityMap: dateAvailability.availabilityMap } : {}) };
  }

  if (error?.code === "42703") {
    let fallbackQuery = supabase
      .from("shelters")
      .select(SHELTER_SELECT_FALLBACK)
      .is("duplicate_of_shelter_id", null);
    if (sort === "rating") {
      fallbackQuery = fallbackQuery
        .order("google_rating", { ascending: false, nullsFirst: false })
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    } else if (sort === "reviews") {
      fallbackQuery = fallbackQuery
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("google_rating", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    } else {
      fallbackQuery = fallbackQuery
        .order("image_url", { ascending: true, nullsFirst: false })
        .order("google_user_ratings_total", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true });
    }
    if (region && region.trim()) {
      fallbackQuery = fallbackQuery.eq("region", region.trim());
    }
    if (areaSlug && areaSlug.trim()) {
      fallbackQuery = fallbackQuery.eq("area_slug", areaSlug.trim());
    }
    if (q && q.trim()) {
      // Samme variant-expansion som primary query — så fallback-resultaterne
      // også fanger Aarhus/Århus, kobenhavn/København etc.
      const variants = expandDanishVariants(q.trim());
      const patternFor = (v: string) => `"%${v.replace(/"/g, '""')}%"`;

      const fbAreaResults = await Promise.all(
        variants.map((v) =>
          supabase.from("areas").select("slug").ilike("name", `%${v}%`).limit(5)
        )
      );
      const fbAreaSlugs = new Set<string>();
      for (const res of fbAreaResults) {
        for (const a of (res.data as { slug: string }[]) ?? []) {
          if (a.slug) fbAreaSlugs.add(a.slug);
        }
      }

      const fbOrPartsArr: string[] = [];
      for (const v of variants) {
        const p = patternFor(v);
        fbOrPartsArr.push(`title.ilike.${p}`, `region.ilike.${p}`, `kommune.ilike.${p}`);
      }
      for (const slug of fbAreaSlugs) {
        fbOrPartsArr.push(`area_slug.eq.${slug}`);
      }
      for (const v of variants) {
        const synonymKommuner = SEARCH_SYNONYMS[v];
        if (synonymKommuner) {
          for (const k of synonymKommuner) fbOrPartsArr.push(`kommune.eq.${k}`);
        }
      }
      fallbackQuery = fallbackQuery.or(fbOrPartsArr.join(","));
    }
    if (filters?.anmeldelser) {
      fallbackQuery = fallbackQuery.not("google_user_ratings_total", "is", null).gt("google_user_ratings_total", 0);
    }
    if (filters?.vand) {
      fallbackQuery = fallbackQuery.eq("water", true);
    }
    if (filters?.toilet) {
      fallbackQuery = fallbackQuery.in("toilet", ["flush", "mulch"]);
    }
    if (filters?.hund) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
    }
    if (filters?.baalplads) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>baalplads", "ilike", "%ja%");
    }
    if (filters?.gratis) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>betaling", "eq", "Nej");
    }
    if (filters?.handicap) {
      fallbackQuery = fallbackQuery.or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet");
    }
    if (filters?.bord_baenk) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>bord_baenk", "ilike", "%ja%");
    }
    if (filters?.strand) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
    }
    if (filters?.bruser) {
      fallbackQuery = fallbackQuery.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
    }
    const { data: fallbackData } = await fallbackQuery.range(from, toInclusive);
    let list = (fallbackData as Shelter[]) ?? [];
    if (useBbox && bbox) {
      list = list.filter((row) => {
        const coords = getLocationCoords(row);
        if (!coords) return false;
        return (
          coords.lat >= bbox.minLat &&
          coords.lat <= bbox.maxLat &&
          coords.lon >= bbox.minLon &&
          coords.lon <= bbox.maxLon
        );
      });
      if (bookbarFilterActive) {
        list = list.filter((s) => isStructuredBookable(s));
      }
      list.sort(sortByImageAndScore);
      const pruned = prunePlaceOutliersForExactQuery(list, q);
      return {
        shelters: pruned,
        hasMore: false,
        ...(dateAvailability ? { availabilityMap: dateAvailability.availabilityMap } : {}),
      };
    }
    list = prunePlaceOutliersForExactQuery(list, q);
    list.sort(sortByImageAndScore);
    const paged = bookbarFilterActive
      ? sliceBookableResults(list, page, pageSize)
      : { shelters: list.slice(0, pageSize), hasMore: list.length >= pageSize };
    return {
      shelters: paged.shelters,
      hasMore: paged.hasMore,
      ...(dateAvailability ? { availabilityMap: dateAvailability.availabilityMap } : {}),
    };
  }

  if (error) {
    console.error("Supabase error (soeg):", error);
    return { shelters: [], hasMore: false };
  }

  let list = ((data as Shelter[]) ?? []);
  list = prunePlaceOutliersForExactQuery(list, q);
  // Only apply default client sort when using standard sort (server already sorted)
  if (!sort || sort === "standard") {
    list = [...list].sort(sortByImageAndScore);
  }
  const paged = bookbarFilterActive
    ? sliceBookableResults(list, page, pageSize)
    : { shelters: list.slice(0, pageSize), hasMore: list.length >= pageSize };
  return {
    shelters: paged.shelters,
    hasMore: paged.hasMore,
    ...(dateAvailability ? { availabilityMap: dateAvailability.availabilityMap } : {}),
  };
}

const SUGGEST_LIMIT = 10;

export interface SearchSuggestion {
  name: string;
  type: "by" | "område" | "region" | "shelter" | "recent" | "popular" | "naer-mig";
}

const REGION_SUGGESTIONS = [
  { name: "Jylland", type: "region" as const },
  { name: "Sjælland", type: "region" as const },
  { name: "Fyn", type: "region" as const },
  { name: "Bornholm", type: "region" as const },
];

/**
 * Hent byer (kommune) og områder (place) der matcher prefix – til autocomplete.
 * Returnerer sorteret, unikke forslag med type-markør, max SUGGEST_LIMIT.
 */
export async function getSuggestions(prefix: string): Promise<SearchSuggestion[]> {
  const term = (prefix || "").trim();
  if (term.length < 2) return [];

  const supabase = createPublicClient();
  const escapePct = (s: string) => s.replace(/%/g, "\\%").replace(/_/g, "\\_");

  // Expand til alle plausible danske staver (Aarhus/Århus, kobenhavn/
  // København, soenderborg/Sønderborg etc.) så autocomplete fanger
  // uanset om brugeren skriver med æøå eller uden.
  const variants = expandDanishVariants(term);
  const prefixPatterns = variants.map((v) => `${escapePct(v)}%`);
  const containsPatterns = variants.map((v) => `%${escapePct(v)}%`);

  // Hjælpefunktion: kør én ilike-query per variant, parallelt, og smelt
  // resultaterne sammen i én Map (deduper på lowercased value).
  type RowMap = Map<string, string>;
  const fetchUnion = async (
    column: "kommune" | "place" | "title" | "name",
    table: "shelters" | "areas",
    patterns: string[],
    limitPerQuery: number,
    withDupFilter: boolean
  ): Promise<RowMap> => {
    const out: RowMap = new Map();
    const queries = patterns.map((p) => {
      let q = supabase.from(table).select(column).ilike(column, p).limit(limitPerQuery);
      if (table === "shelters") {
        q = q.is("duplicate_of_shelter_id", null).not(column, "is", null);
        // (withDupFilter er altid true for shelters — kept for symmetry)
        void withDupFilter;
      }
      return q;
    });
    const results = await Promise.all(queries);
    for (const res of results) {
      for (const row of (res.data as Record<string, string>[]) ?? []) {
        const v = (row[column] || "").trim();
        if (v) out.set(v.toLowerCase(), v);
      }
    }
    return out;
  };

  const [kommuneMap, placeMap, areaMap, shelterTitleMap] = await Promise.all([
    fetchUnion("kommune", "shelters", prefixPatterns, 80, true),
    fetchUnion("place", "shelters", containsPatterns, 80, true),
    fetchUnion("name", "areas", containsPatterns, 20, false),
    fetchUnion("title", "shelters", prefixPatterns, 5, true),
  ]);

  // Bagudkompatibel form til den eksisterende for-loop nedenunder
  const kommuneRes = { data: [...kommuneMap.values()].map((kommune) => ({ kommune })), error: null as Error | null };
  const placeRes = { data: [...placeMap.values()].map((place) => ({ place })), error: null as Error | null };
  const areaRes = { data: [...areaMap.values()].map((name) => ({ name })), error: null as Error | null };
  const shelterTitleRes = { data: [...shelterTitleMap.values()].map((title) => ({ title })), error: null as Error | null };

  if (kommuneRes.error) console.error("Supabase error (kommune suggestions):", kommuneRes.error);
  if (placeRes.error) console.error("Supabase error (place suggestions):", placeRes.error);
  if (areaRes.error) console.error("Supabase error (area suggestions):", areaRes.error);
  if (shelterTitleRes.error) console.error("Supabase error (shelter title suggestions):", shelterTitleRes.error);

  const seen = new Set<string>();
  const results: SearchSuggestion[] = [];

  // Postnummer-forslag: når bruger taster 1-4 cifre → vis "Billund (7190)"
  if (/^\d{1,4}$/.test(term)) {
    const postalMatches = findPostnummerSuggestions(term);
    for (const { code, city } of postalMatches) {
      const key = `postnr:${code}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ name: `${city} (${code})`, type: "by" });
      }
    }
    // Kun postnummer-forslag når input er rent numerisk
    return results.slice(0, SUGGEST_LIMIT);
  }

  // Regioner (Jylland, Sjælland, Fyn, Bornholm) – prefix-match med varianter,
  // så "Sjaelland" også matcher "Sjælland" og omvendt.
  for (const r of REGION_SUGGESTIONS) {
    const rNameLower = r.name.toLowerCase();
    const rKey = rNameLower;
    if (seen.has(rKey)) continue;
    if (variants.some((v) => rNameLower.startsWith(v))) {
      seen.add(rKey);
      results.push(r);
    }
  }

  // Geografiske synonymer som forslag (fx "Sønderjylland", "Nordjylland") –
  // prefix-match mod hver variant så ASCII-input også finder æøå-keys.
  for (const key of Object.keys(SEARCH_SYNONYMS)) {
    if (seen.has(key)) continue;
    if (variants.some((v) => key.startsWith(v))) {
      const displayName = key.charAt(0).toUpperCase() + key.slice(1);
      seen.add(key);
      results.push({ name: displayName, type: "område" });
    }
  }

  // Byer først (eksakt prefix-match)
  for (const row of (kommuneRes.data as { kommune: string }[]) ?? []) {
    const k = (row.kommune || "").trim();
    const key = k.toLowerCase();
    if (!k || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: k, type: "by" });
  }

  // Navngivne områder fra areas-tabellen (nationalparker, øer m.m.)
  for (const row of (areaRes.data as { name: string }[]) ?? []) {
    const a = (row.name || "").trim();
    const key = a.toLowerCase();
    if (!a || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: a, type: "område" });
  }

  // Områder fra place-feltet (contains-match, undgå duplikater)
  for (const row of (placeRes.data as { place: string }[]) ?? []) {
    const p = (row.place || "").trim();
    const key = p.toLowerCase();
    if (!p || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: p, type: "område" });
  }

  // Shelter-titler (prefix-match, vises sidst)
  for (const row of (shelterTitleRes.data as { title: string }[]) ?? []) {
    const t = (row.title || "").trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: t, type: "shelter" });
  }

  // Sortér: eksakte prefix-matches først, derefter alfabetisk
  const lowerTerm = term.toLowerCase();
  results.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(lowerTerm) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(lowerTerm) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.name.localeCompare(b.name, "da");
  });

  return results.slice(0, SUGGEST_LIMIT);
}

/** Baglæns-kompatibel: returnerer bare bynavne som strings. */
export async function getByerSuggestions(prefix: string): Promise<string[]> {
  const suggestions = await getSuggestions(prefix);
  return suggestions.map((s) => s.name);
}

/** Slank pin til kortet — matcher MapShelter i lib/map-shelter.ts. */
export interface ShelterPin {
  id: string;
  slug: string;
  title: string;
  region: string | null;
  kommune: string | null;
  image_url: string | null;
  location: string | null;
}

const PIN_COLS = "id, slug, title, region, kommune, image_url, location";
const PINS_MAX = 4000;

/**
 * ALLE shelters der matcher region/q/filtre — som slanke pins til kortet.
 * Kort-visningen var før cappet til én side (200), så landsvisningen
 * underrapporterede massivt (200 af 1.663). Paginerer forbi PostgRESTs
 * 1000-rækkers loft. Samme filter-semantik som getSheltersPage.
 */
export async function getShelterPins(
  region?: string | null,
  q?: string | null,
  filters?: SoegFilters | null
): Promise<ShelterPin[]> {
  const supabase = createPublicClient();
  const out: ShelterPin[] = [];
  let offset = 0;

  while (out.length < PINS_MAX) {
    let query = supabase
      .from("shelters")
      .select(PIN_COLS)
      .is("duplicate_of_shelter_id", null)
      .not("slug", "is", null)
      .order("id");

    if (region && region.trim()) query = query.eq("region", region.trim());

    if (q && q.trim()) {
      const variants = expandDanishVariants(q.trim());
      const patternFor = (v: string) => `"%${v.replace(/"/g, '""')}%"`;
      const orPartsArr: string[] = [];
      for (const v of variants) {
        const pat = patternFor(v);
        orPartsArr.push(`title.ilike.${pat}`, `region.ilike.${pat}`, `kommune.ilike.${pat}`, `place.ilike.${pat}`);
      }
      for (const v of variants) {
        const synonymKommuner = SEARCH_SYNONYMS[v];
        if (synonymKommuner) for (const k of synonymKommuner) orPartsArr.push(`kommune.eq.${k}`);
      }
      query = query.or(orPartsArr.join(","));
    }

    if (filters?.anmeldelser) query = query.not("google_user_ratings_total", "is", null).gt("google_user_ratings_total", 0);
    if (filters?.vand) query = query.eq("water", true);
    if (filters?.toilet) query = query.in("toilet", ["flush", "mulch"]);
    if (filters?.hund) query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%");
    if (filters?.baalplads) query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%");
    if (filters?.handicap) query = query.or("geofa_raw->>handicap.ilike.Handicapegnet,geofa_raw->>handicap.ilike.Delvist handicapegnet");
    if (filters?.bord_baenk) query = query.filter("geofa_raw->>bord_baenk", "ilike", "%ja%");
    if (filters?.strand) query = query.filter("geofa_raw->>strand_naerhed", "ilike", "%ja%");
    if (filters?.bruser) query = query.filter("geofa_raw->>bruser_bad", "ilike", "%ja%");
    if (filters?.min_pladser && filters.min_pladser > 0) query = query.gte("capacity", filters.min_pladser);

    const { data, error } = await query.range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    out.push(...(data as ShelterPin[]));
    if (data.length < 1000) break;
    offset += 1000;
  }

  // bookbar er post-filter (isStructuredBookable kræver flere felter) — pins
  // til bookbar-filteret håndteres af klienten via listens datasæt i stedet.
  return out;
}

