import { createAdminClient } from "@/utils/supabase/server-admin";
import type {
  BookableShelter,
  ShelterBooking,
  BookingActionToken,
  BookingAction,
} from "@/types/booking";

// ─── Shelter lookup ──────────────────────────────────────────────────────────

export async function getBookableShelterBySlug(
  slug: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("slug", slug)
    .single();
  return data ?? null;
}

export async function getBookableShelterByOwnerToken(
  token: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("owner_token", token)
    .single();
  return data ?? null;
}

/** Find bookable shelter linked to a shelters.id (for detail page button) */
export async function getBookableShelterByShelterDbId(
  shelterId: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("shelter_id", shelterId)
    .single();
  return data ?? null;
}

// ─── Availability ────────────────────────────────────────────────────────────

/**
 * Returns all non-free dates for a shelter as a Record<isoDate, status>.
 * Only returns dates from today onwards (90 days window for performance).
 */
export async function getUnavailableDates(
  bookableShelterDbId: string
): Promise<Record<string, "pending" | "confirmed" | "blocked">> {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [bookingsResult, blockedResult] = await Promise.all([
    createAdminClient()
      .from("shelter_bookings")
      .select("check_in, check_out, status")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .in("status", ["pending", "confirmed"])
      .gte("check_out", today)
      .lte("check_in", until), // cap at 90-day window
    createAdminClient()
      .from("shelter_blocked_dates")
      .select("blocked_date")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .gte("blocked_date", today)
      .lte("blocked_date", until),
  ]);

  const result: Record<string, "pending" | "confirmed" | "blocked"> = {};

  // Expand booking date ranges into individual days
  for (const b of bookingsResult.data ?? []) {
    const start = new Date(b.check_in);
    const end = new Date(b.check_out);
    const cur = new Date(start);
    while (cur < end) {
      const iso = cur.toISOString().slice(0, 10);
      // confirmed beats pending
      if (result[iso] !== "confirmed") {
        result[iso] = b.status as "pending" | "confirmed";
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const d of blockedResult.data ?? []) {
    result[d.blocked_date] = "blocked";
  }

  return result;
}

// ─── Booking creation ────────────────────────────────────────────────────────

export async function createBooking(data: {
  bookable_shelter_id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  message: string | null;
}): Promise<ShelterBooking> {
  const { data: booking, error } = await createAdminClient()
    .from("shelter_bookings")
    .insert(data)
    .select()
    .single();
  if (error || !booking) throw new Error("Kunne ikke oprette booking: " + error?.message);
  return booking as ShelterBooking;
}

/** Creates two action tokens (confirm + reject) for a booking. Returns { confirmToken, rejectToken }. */
export async function createActionTokens(
  bookingId: string
): Promise<{ confirmToken: string; rejectToken: string }> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from("booking_action_tokens")
    .insert([
      { booking_id: bookingId, action: "confirm", expires_at: expiresAt },
      { booking_id: bookingId, action: "reject", expires_at: expiresAt },
    ])
    .select("action, token");
  if (error || !data) throw new Error("Kunne ikke oprette action tokens: " + error?.message);
  const confirmToken = data.find((r) => r.action === "confirm")!.token;
  const rejectToken = data.find((r) => r.action === "reject")!.token;
  return { confirmToken, rejectToken };
}

// ─── Action token resolution ─────────────────────────────────────────────────

export interface ActionTokenResult {
  token: BookingActionToken;
  booking: ShelterBooking;
  shelter: BookableShelter;
}

/**
 * Resolves an action token. Returns null if not found.
 * Does NOT check expiry or used_at — caller decides what to do.
 */
export async function resolveActionToken(
  token: string
): Promise<ActionTokenResult | null> {
  const { data: tokenRow } = await createAdminClient()
    .from("booking_action_tokens")
    .select("*")
    .eq("token", token)
    .single();
  if (!tokenRow) return null;

  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("id", tokenRow.booking_id)
    .single();
  if (!booking) return null;

  const { data: shelter } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", booking.bookable_shelter_id)
    .single();
  if (!shelter) return null;

  return {
    token: tokenRow as BookingActionToken,
    booking: booking as ShelterBooking,
    shelter: shelter as BookableShelter,
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await createAdminClient()
    .from("booking_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);
}

export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "rejected"
): Promise<void> {
  await createAdminClient()
    .from("shelter_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);
}

/**
 * Checks if accepting a booking would cause a conflict with an already-confirmed booking.
 * Returns true if there IS a conflict (should NOT accept).
 */
export async function hasConfirmedOverlap(
  bookableShelterDbId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string
): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("status", "confirmed")
    .neq("id", excludeBookingId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  return (data?.length ?? 0) > 0;
}

// ─── Owner dashboard ─────────────────────────────────────────────────────────

export async function getBookingsForShelter(
  bookableShelterDbId: string
): Promise<ShelterBooking[]> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .order("check_in", { ascending: true });
  return (data ?? []) as ShelterBooking[];
}

/** Lookup a single booking that belongs to a specific shelter (used in owner/action to avoid full scan). */
export async function getBookingByIdForShelter(
  bookingId: string,
  bookableShelterDbId: string
): Promise<ShelterBooking | null> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("bookable_shelter_id", bookableShelterDbId)
    .single();
  return data as ShelterBooking | null;
}

export async function getBlockedDatesForShelter(
  bookableShelterDbId: string
): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("shelter_blocked_dates")
    .select("blocked_date")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .gte("blocked_date", new Date().toISOString().slice(0, 10))
    .order("blocked_date", { ascending: true });
  return (data ?? []).map((d) => d.blocked_date as string);
}

export async function blockDate(
  bookableShelterDbId: string,
  date: string,
  reason: string | null
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .upsert({ bookable_shelter_id: bookableShelterDbId, blocked_date: date, reason });
}

export async function unblockDate(
  bookableShelterDbId: string,
  date: string
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .delete()
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("blocked_date", date);
}

// ─── iCal integration ────────────────────────────────────────────────────────

/** Returns blocked dates WITH source field — for owner dashboard legend. */
export async function getBlockedDatesWithSource(
  bookableShelterDbId: string
): Promise<{ date: string; source: "manual" | "ical_sync" }[]> {
  const { data } = await createAdminClient()
    .from("shelter_blocked_dates")
    .select("blocked_date, source")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .gte("blocked_date", new Date().toISOString().slice(0, 10))
    .order("blocked_date", { ascending: true });
  return (data ?? []).map((d) => ({
    date: d.blocked_date as string,
    source: (d.source ?? "manual") as "manual" | "ical_sync",
  }));
}

export async function saveIcalImportUrl(
  bookableShelterDbId: string,
  url: string | null
): Promise<void> {
  await createAdminClient()
    .from("bookable_shelters")
    .update({ ical_import_url: url })
    .eq("id", bookableShelterDbId);
}

export async function updateIcalLastSynced(
  bookableShelterDbId: string
): Promise<void> {
  await createAdminClient()
    .from("bookable_shelters")
    .update({ ical_last_synced_at: new Date().toISOString() })
    .eq("id", bookableShelterDbId);
}

export async function deleteIcalSyncedDates(
  bookableShelterDbId: string
): Promise<void> {
  await createAdminClient()
    .from("shelter_blocked_dates")
    .delete()
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("source", "ical_sync");
}

export async function blockDatesFromSync(
  bookableShelterDbId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  await createAdminClient()
    .from("shelter_blocked_dates")
    .upsert(
      dates.map((d) => ({
        bookable_shelter_id: bookableShelterDbId,
        blocked_date: d,
        source: "ical_sync",
      }))
    );
}
