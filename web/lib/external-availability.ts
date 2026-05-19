import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";
import {
  getUnavailableDates,
  listBookableSheltersByShelterDbId,
} from "@/lib/booking-db";
import type { ShelterAvailabilityResponse } from "@/types/booking";
import type {
  ShelterAvailabilityConfidence,
  ShelterAvailabilityMode,
  ShelterAvailabilityProvider,
} from "@/types/shelter";
import { createAdminClient } from "@/utils/supabase/server-admin";

type AvailabilityShelterRow = {
  id: string;
  slug: string;
  booking_url: string | null;
  availability_provider?: ShelterAvailabilityProvider | null;
  availability_mode?: ShelterAvailabilityMode | null;
  availability_lookup_key?: string | null;
  availability_url?: string | null;
  availability_verified_at?: string | null;
  availability_confidence?: ShelterAvailabilityConfidence | null;
};

type ExternalAvailabilityDayRow = {
  day: string;
  state: "available" | "booked" | "partial" | "unknown";
  fetched_at: string;
};

type ExternalAvailabilitySnapshotRow = {
  fetched_at: string;
  status: string;
};

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildStaleFlag(lastSyncedAt: string | null, maxAgeHours: number): boolean {
  if (!lastSyncedAt) return true;
  const synced = Date.parse(lastSyncedAt);
  if (!Number.isFinite(synced)) return true;
  return Date.now() - synced > maxAgeHours * 60 * 60 * 1000;
}

async function getAvailabilityShelterBySlug(
  slug: string
): Promise<AvailabilityShelterRow | null> {
  const { data, error } = await createAdminClient()
    .from("shelters")
    .select(
      "id, slug, booking_url, availability_provider, availability_mode, availability_lookup_key, availability_url, availability_verified_at, availability_confidence"
    )
    .eq("slug", slug)
    .is("duplicate_of_shelter_id", null)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error("getAvailabilityShelterBySlug: " + error.message);
  return (data as AvailabilityShelterRow | null) ?? null;
}

async function getExternalAvailabilityDays(
  shelterId: string,
  provider: "naturstyrelsen"
): Promise<ExternalAvailabilityDayRow[]> {
  const from = isoDate(new Date());
  const to = isoDate(
    new Date(Date.now() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  );

  const { data, error } = await createAdminClient()
    .from("external_availability_days")
    .select("day, state, fetched_at")
    .eq("shelter_id", shelterId)
    .eq("provider", provider)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (error) throw new Error("getExternalAvailabilityDays: " + error.message);
  return (data as ExternalAvailabilityDayRow[] | null) ?? [];
}

async function getLatestExternalAvailabilitySnapshot(
  shelterId: string,
  provider: "naturstyrelsen"
): Promise<ExternalAvailabilitySnapshotRow | null> {
  const { data, error } = await createAdminClient()
    .from("external_availability_snapshots")
    .select("fetched_at, status")
    .eq("shelter_id", shelterId)
    .eq("provider", provider)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      "getLatestExternalAvailabilitySnapshot: " + error.message
    );
  }

  return (data as ExternalAvailabilitySnapshotRow | null) ?? null;
}

export async function getShelterAvailabilityBySlug(
  slug: string
): Promise<ShelterAvailabilityResponse | null> {
  const shelter = await getAvailabilityShelterBySlug(slug);
  if (!shelter) return null;

  const units = await listBookableSheltersByShelterDbId(shelter.id);

  if (units.length === 1) {
    const dates = await getUnavailableDates(units[0].id);
    return {
      provider: "shelterdk",
      mode: "internal_live",
      source_url: null,
      lookup_key: units[0].id,
      last_synced_at: null,
      stale: false,
      has_data: Object.keys(dates).length > 0,
      unit_count: 1,
      days: dates,
    };
  }

  if (units.length > 1) {
    return {
      provider: "shelterdk",
      mode: "internal_live",
      source_url: null,
      lookup_key: null,
      last_synced_at: null,
      stale: false,
      has_data: false,
      unit_count: units.length,
      days: {},
    };
  }

  const provider = shelter.availability_provider ?? "unknown";
  const mode = shelter.availability_mode ?? "none";
  const sourceUrl = shelter.availability_url ?? shelter.booking_url ?? null;

  if (provider === "naturstyrelsen" && mode === "external_cached") {
    const [dayRows, latestSnapshot] = await Promise.all([
      getExternalAvailabilityDays(shelter.id, provider),
      getLatestExternalAvailabilitySnapshot(shelter.id, provider),
    ]);
    const days = Object.fromEntries(dayRows.map((row) => [row.day, row.state]));
    const lastSyncedAt =
      dayRows.reduce<string | null>(
        (latest, row) =>
          !latest || Date.parse(row.fetched_at) > Date.parse(latest)
            ? row.fetched_at
            : latest,
        latestSnapshot?.fetched_at ??
          shelter.availability_verified_at ??
          null
      ) ?? null;

    return {
      provider,
      mode,
      source_url: sourceUrl,
      lookup_key: shelter.availability_lookup_key ?? null,
      last_synced_at: lastSyncedAt,
      stale: buildStaleFlag(lastSyncedAt, 6),
      has_data:
        latestSnapshot?.status === "success" || dayRows.length > 0,
      unit_count: 0,
      days,
    };
  }

  return {
    provider,
    mode: mode === "none" ? "none" : "external_unknown",
    source_url: sourceUrl,
    lookup_key: shelter.availability_lookup_key ?? null,
    last_synced_at: shelter.availability_verified_at ?? null,
    stale: true,
    has_data: false,
    unit_count: 0,
    days: {},
  };
}
