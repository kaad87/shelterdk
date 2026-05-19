import { createAdminClient } from "@/utils/supabase/server-admin";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";
import type {
  ShelterAvailabilityConfidence,
  ShelterAvailabilityMode,
  ShelterAvailabilityProvider,
} from "@/types/shelter";

const NST_BOOKING_ORIGIN = "https://book.naturstyrelsen.dk";

type NaturstyrelsenShelterRow = {
  id: string;
  slug: string;
  title: string;
  booking_url: string | null;
  booking_provider?: string | null;
  booking_link_mode?: string | null;
  availability_provider?: ShelterAvailabilityProvider | null;
  availability_mode?: ShelterAvailabilityMode | null;
  availability_lookup_key?: string | null;
  availability_url?: string | null;
  availability_verified_at?: string | null;
  availability_confidence?: ShelterAvailabilityConfidence | null;
};

type NaturstyrelsenAvailabilityPayload = {
  BookingDates?: unknown;
  PartialBookingDates?: unknown;
  BookingDatesHolder?: unknown;
};

function isConcreteNaturstyrelsenBookingPage(url: string | null | undefined): boolean {
  const normalized = (url ?? "").trim().toLowerCase();
  return normalized.includes("book.naturstyrelsen.dk/sted/");
}

export type NaturstyrelsenAvailabilityState = "booked" | "partial";

export type NaturstyrelsenAvailabilityDay = {
  day: string;
  state: NaturstyrelsenAvailabilityState;
};

export type NaturstyrelsenSyncResult =
  | {
      status: "success";
      shelterId: string;
      slug: string;
      lookupKey: string;
      fetchedAt: string;
      dayCount: number;
      hadPidRefresh: boolean;
    }
  | {
      status: "skipped";
      shelterId: string;
      slug: string;
      reason: string;
    }
  | {
      status: "error";
      shelterId: string;
      slug: string;
      reason: string;
    };

function extractStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function asIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function extractNaturstyrelsenPid(html: string): string | null {
  const patterns = [
    /name=["']PID["'][^>]*value=["'](\d+)["']/i,
    /value=["'](\d+)["'][^>]*name=["']PID["']/i,
    /\bPID\s*[:=]\s*["']?(\d+)["']?/i,
    /\biPlaceID\s*[:=]\s*["']?(\d+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function normalizeNaturstyrelsenAvailabilityPayload(
  payload: NaturstyrelsenAvailabilityPayload
): NaturstyrelsenAvailabilityDay[] {
  const bookedDates = extractStringArray(payload.BookingDates);
  const partialDates = extractStringArray(payload.PartialBookingDates);

  const days = new Map<string, NaturstyrelsenAvailabilityState>();

  for (const rawDay of bookedDates) {
    const day = asIsoDate(rawDay);
    if (day) days.set(day, "booked");
  }

  for (const rawDay of partialDates) {
    const day = asIsoDate(rawDay);
    if (!day) continue;
    if (!days.has(day)) {
      days.set(day, "partial");
    }
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, state]) => ({ day, state }));
}

function formatNaturstyrelsenQueryDate(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, count: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function buildNaturstyrelsenSyncDates(
  from = new Date(),
  bookingWindowDays = BOOKING_WINDOW_DAYS
): Date[] {
  const start = startOfMonth(from);
  const end = new Date(from.getTime() + bookingWindowDays * 24 * 60 * 60 * 1000);
  const dates: Date[] = [];

  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    dates.push(cursor);
  }

  return dates;
}

async function fetchNaturstyrelsenPageHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ShelterDK/1.0; +https://shelterdk.dk)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NST booking page returned ${response.status}`);
  }

  return response.text();
}

async function fetchNaturstyrelsenAvailabilityPayload(
  pid: string,
  date = new Date()
): Promise<NaturstyrelsenAvailabilityPayload> {
  const endpoint = new URL(
    "/includes/branding_files/shelterbooking/includes/inc_ajaxgetbookingsforsingleplace.asp",
    NST_BOOKING_ORIGIN
  );
  endpoint.searchParams.set("i", pid);
  endpoint.searchParams.set("d", formatNaturstyrelsenQueryDate(date));

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ShelterDK/1.0; +https://shelterdk.dk)",
      Accept: "application/json,text/plain,*/*",
      "X-Requested-With": "XMLHttpRequest",
      Referer: NST_BOOKING_ORIGIN,
      "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NST availability endpoint returned ${response.status}`);
  }

  return (await response.json()) as NaturstyrelsenAvailabilityPayload;
}

async function fetchNaturstyrelsenAvailabilityWindow(
  pid: string
): Promise<{
  payloads: NaturstyrelsenAvailabilityPayload[];
  days: NaturstyrelsenAvailabilityDay[];
}> {
  const queryDates = buildNaturstyrelsenSyncDates();
  const payloads: NaturstyrelsenAvailabilityPayload[] = [];
  const merged = new Map<string, NaturstyrelsenAvailabilityState>();

  for (const queryDate of queryDates) {
    const payload = await fetchNaturstyrelsenAvailabilityPayload(pid, queryDate);
    payloads.push(payload);

    for (const day of normalizeNaturstyrelsenAvailabilityPayload(payload)) {
      if (day.state === "booked" || !merged.has(day.day)) {
        merged.set(day.day, day.state);
      }
    }
  }

  const days = [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, state]) => ({ day, state }));

  return { payloads, days };
}

async function listNaturstyrelsenShelters(): Promise<NaturstyrelsenShelterRow[]> {
  const { data, error } = await createAdminClient()
    .from("shelters")
    .select(
      "id, slug, title, booking_url, booking_provider, booking_link_mode, availability_provider, availability_mode, availability_lookup_key, availability_url, availability_verified_at, availability_confidence"
    )
    .is("duplicate_of_shelter_id", null)
    .or(
      [
        "availability_provider.eq.naturstyrelsen",
        "booking_provider.eq.naturstyrelsen",
        "booking_url.ilike.%book.naturstyrelsen.dk%",
      ].join(",")
    )
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Kunne ikke hente NST-shelters: ${error.message}`);
  }

  const rows = (data as NaturstyrelsenShelterRow[] | null) ?? [];
  return rows.filter((row) => {
    if (row.availability_lookup_key?.trim()) return true;
    return isConcreteNaturstyrelsenBookingPage(
      row.availability_url ?? row.booking_url
    );
  });
}

async function updateShelterAvailabilityMetadata(
  shelter: NaturstyrelsenShelterRow,
  pid: string
) {
  const now = new Date().toISOString();
  const payload = {
    availability_provider: "naturstyrelsen" as ShelterAvailabilityProvider,
    availability_mode: "external_cached" as ShelterAvailabilityMode,
    availability_lookup_key: pid,
    availability_url: shelter.availability_url ?? shelter.booking_url ?? null,
    availability_verified_at: now,
    availability_confidence:
      shelter.availability_confidence ?? ("verified_match" as ShelterAvailabilityConfidence),
  };

  const { error } = await createAdminClient()
    .from("shelters")
    .update(payload)
    .eq("id", shelter.id);

  if (error) {
    throw new Error(
      `Kunne ikke gemme availability-metadata for ${shelter.slug}: ${error.message}`
    );
  }

  return { ...shelter, ...payload };
}

async function ensureNaturstyrelsenPid(
  shelter: NaturstyrelsenShelterRow
): Promise<{ pid: string; refreshed: boolean; shelter: NaturstyrelsenShelterRow }> {
  if (shelter.availability_lookup_key?.trim()) {
    return {
      pid: shelter.availability_lookup_key.trim(),
      refreshed: false,
      shelter,
    };
  }

  const sourceUrl = shelter.availability_url ?? shelter.booking_url ?? null;
  if (!sourceUrl || !sourceUrl.includes("/sted/")) {
    throw new Error("Mangler konkret Naturstyrelsen booking-side");
  }

  const html = await fetchNaturstyrelsenPageHtml(sourceUrl);
  const pid = extractNaturstyrelsenPid(html);
  if (!pid) {
    throw new Error("Kunne ikke udlede Naturstyrelsen PID fra HTML");
  }

  const updatedShelter = await updateShelterAvailabilityMetadata(shelter, pid);
  return { pid, refreshed: true, shelter: updatedShelter };
}

async function replaceShelterAvailabilityDays(
  shelterId: string,
  provider: ShelterAvailabilityProvider,
  fetchedAt: string,
  days: NaturstyrelsenAvailabilityDay[]
) {
  const client = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error: deleteError } = await client
    .from("external_availability_days")
    .delete()
    .eq("shelter_id", shelterId)
    .eq("provider", provider)
    .gte("day", today);

  if (deleteError) {
    throw new Error(`Kunne ikke rydde gamle availability-dage: ${deleteError.message}`);
  }

  if (days.length === 0) return;

  const { error: insertError } = await client
    .from("external_availability_days")
    .upsert(
      days.map((day) => ({
        shelter_id: shelterId,
        provider,
        day: day.day,
        state: day.state,
        fetched_at: fetchedAt,
      })),
      { onConflict: "shelter_id,provider,day" }
    );

  if (insertError) {
    throw new Error(`Kunne ikke gemme availability-dage: ${insertError.message}`);
  }
}

async function insertAvailabilitySnapshot(args: {
  shelterId: string;
  provider: ShelterAvailabilityProvider;
  lookupKey: string;
  fetchedAt: string;
  status: "success" | "error" | "skipped";
  payload: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const { error } = await createAdminClient()
    .from("external_availability_snapshots")
    .insert({
      shelter_id: args.shelterId,
      provider: args.provider,
      lookup_key: args.lookupKey,
      as_of_date: args.fetchedAt.slice(0, 10),
      fetched_at: args.fetchedAt,
      status: args.status,
      error_message: args.errorMessage ?? null,
      payload: args.payload,
    });

  if (error) {
    throw new Error(`Kunne ikke gemme availability snapshot: ${error.message}`);
  }
}

export async function syncNaturstyrelsenAvailabilityForShelter(
  shelter: NaturstyrelsenShelterRow
): Promise<NaturstyrelsenSyncResult> {
  if (
    shelter.availability_provider !== "naturstyrelsen" &&
    shelter.booking_provider !== "naturstyrelsen" &&
    !(shelter.booking_url ?? "").includes("book.naturstyrelsen.dk")
  ) {
    return {
      status: "skipped",
      shelterId: shelter.id,
      slug: shelter.slug,
      reason: "Shelter er ikke koblet til Naturstyrelsen",
    };
  }

  if (
    !shelter.availability_lookup_key?.trim() &&
    !isConcreteNaturstyrelsenBookingPage(
      shelter.availability_url ?? shelter.booking_url
    )
  ) {
    return {
      status: "skipped",
      shelterId: shelter.id,
      slug: shelter.slug,
      reason: "Mangler konkret Naturstyrelsen booking-side",
    };
  }

  try {
    const { pid, refreshed } = await ensureNaturstyrelsenPid(shelter);
    const { payloads, days } = await fetchNaturstyrelsenAvailabilityWindow(pid);
    const fetchedAt = new Date().toISOString();

    await replaceShelterAvailabilityDays(
      shelter.id,
      "naturstyrelsen",
      fetchedAt,
      days
    );
    await insertAvailabilitySnapshot({
      shelterId: shelter.id,
      provider: "naturstyrelsen",
      lookupKey: pid,
      fetchedAt,
      status: "success",
      payload: {
        monthCount: payloads.length,
        bookingDatesCount: payloads.reduce(
          (sum, payload) => sum + extractStringArray(payload.BookingDates).length,
          0
        ),
        partialDatesCount: payloads.reduce(
          (sum, payload) =>
            sum + extractStringArray(payload.PartialBookingDates).length,
          0
        ),
        dayCount: days.length,
        sourceUrl: shelter.availability_url ?? shelter.booking_url ?? null,
        responses: payloads,
      },
    });

    return {
      status: "success",
      shelterId: shelter.id,
      slug: shelter.slug,
      lookupKey: pid,
      fetchedAt,
      dayCount: days.length,
      hadPidRefresh: refreshed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lookupKey = shelter.availability_lookup_key ?? "missing";
    const fetchedAt = new Date().toISOString();

    await insertAvailabilitySnapshot({
      shelterId: shelter.id,
      provider: "naturstyrelsen",
      lookupKey,
      fetchedAt,
      status: "error",
      errorMessage: message,
      payload: {
        sourceUrl: shelter.availability_url ?? shelter.booking_url ?? null,
      },
    }).catch((snapshotError) => {
      console.error("NST snapshot error insert failed:", snapshotError);
    });

    return {
      status: "error",
      shelterId: shelter.id,
      slug: shelter.slug,
      reason: message,
    };
  }
}

export async function syncNaturstyrelsenAvailabilityBatch() {
  const shelters = await listNaturstyrelsenShelters();
  const results: NaturstyrelsenSyncResult[] = [];

  for (const shelter of shelters) {
    results.push(await syncNaturstyrelsenAvailabilityForShelter(shelter));
  }

  return results;
}
