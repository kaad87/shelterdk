import { createAdminClient } from "@/utils/supabase/server-admin";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";
import type {
  BookableShelter,
  ShelterBooking,
  BookingActionToken,
  BookingAction,
  BookingSource,
} from "@/types/booking";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if a guest can get a full refund based on how far away check_in is.
 * check_in is a date string "YYYY-MM-DD" interpreted as midnight in Denmark
 * (Europe/Copenhagen), so refund cutoffs match the user-facing local date.
 * now defaults to current time — pass explicitly in tests for determinism.
 */
function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneMidnightUtc(checkIn: string, timeZone: string): Date {
  const [year, month, day] = checkIn.split("-").map(Number);
  let candidate = Date.UTC(year, month - 1, day, 0, 0, 0);

  // Iterate a couple of times until the formatted local wall-clock matches
  // the requested zoned midnight. This keeps us DST-safe without extra deps.
  for (let i = 0; i < 4; i += 1) {
    const parts = getZonedDateParts(new Date(candidate), timeZone);
    const desiredWallClock = Date.UTC(year, month - 1, day, 0, 0, 0);
    const actualWallClock = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const delta = desiredWallClock - actualWallClock;
    if (delta === 0) {
      break;
    }
    candidate += delta;
  }

  return new Date(candidate);
}

export function isRefundEligible(
  checkIn: string,
  cutoffHours: number,
  now: Date = new Date()
): boolean {
  const checkInStart = getTimeZoneMidnightUtc(checkIn, "Europe/Copenhagen");
  const hoursUntilCheckIn = (checkInStart.getTime() - now.getTime()) / 3_600_000;
  return hoursUntilCheckIn > cutoffHours;
}

export class BookingConflictError extends Error {
  constructor(message = "De valgte datoer er ikke længere ledige") {
    super(message);
    this.name = "BookingConflictError";
  }
}

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

/** Find all bookable shelters linked to the same shelters.id (for multi-unit booking on one SEO page) */
export async function listBookableSheltersByShelterDbId(
  shelterId: string
): Promise<BookableShelter[]> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("shelter_id", shelterId)
    .order("title", { ascending: true });
  return (data ?? []) as BookableShelter[];
}

// ─── Availability ────────────────────────────────────────────────────────────

/**
 * Returns all non-free dates for a shelter as a Record<isoDate, status>.
 * Only returns dates from today onwards (bounded booking window for performance).
 */
export async function getUnavailableDates(
  bookableShelterDbId: string
): Promise<Record<string, "pending" | "confirmed" | "blocked">> {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [bookingsResult, blockedResult] = await Promise.all([
    createAdminClient()
      .from("shelter_bookings")
      .select("check_in, check_out, status")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .in("status", ["pending", "confirmed"])
      .gte("check_out", today)
      .lte("check_in", until), // cap at booking window
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
  status?: "pending" | "confirmed";
  source?: BookingSource;
  quoted_shelter_dkk?: number | null;
  quoted_platform_dkk?: number | null;
  quoted_total_dkk?: number | null;
}): Promise<ShelterBooking> {
  const { data: booking, error } = await createAdminClient()
    .from("shelter_bookings")
    .insert(data)
    .select()
    .single();
  if (error?.code === "23P01") {
    throw new BookingConflictError();
  }
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
  const confirmRecord = data.find((r) => r.action === "confirm");
  const rejectRecord = data.find((r) => r.action === "reject");
  if (!confirmRecord || !rejectRecord)
    throw new Error("Action tokens mangler efter insert — uventet databasesvar");
  return { confirmToken: confirmRecord.token, rejectToken: rejectRecord.token };
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
  const { data: tokenRow, error } = await createAdminClient()
    .from("booking_action_tokens")
    .select(`
      *,
      shelter_bookings!inner (
        *,
        bookable_shelters!inner (*)
      )
    `)
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("resolveActionToken: " + error.message);
  if (!tokenRow?.shelter_bookings) return null;

  const booking = tokenRow.shelter_bookings as any;
  const shelter = booking.bookable_shelters as any;
  if (!shelter) return null;

  return {
    token: {
      id: tokenRow.id,
      booking_id: tokenRow.booking_id,
      action: tokenRow.action,
      token: tokenRow.token,
      expires_at: tokenRow.expires_at,
      used_at: tokenRow.used_at,
    } as BookingActionToken,
    booking: booking as ShelterBooking,
    shelter: shelter as BookableShelter,
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("booking_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);
  if (error) throw new Error("markTokenUsed: " + error.message);
}

export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "rejected"
): Promise<boolean> {
  // Only update if still pending — prevents race conditions and double-processing
  const { data, error } = await createAdminClient()
    .from("shelter_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("id");
  if (error?.code === "23P01") {
    throw new BookingConflictError();
  }
  if (error) throw new Error("updateBookingStatus: " + error.message);
  return (data ?? []).length > 0;
}

/**
 * Cancel a pending booking before it has been confirmed.
 * Used when payment setup fails or a checkout session expires before payment.
 */
export async function cancelPendingBooking(bookingId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("shelter_bookings")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_by: "system",
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error("cancelPendingBooking: " + error.message);
  return (data ?? []).length > 0;
}

/**
 * Checks if accepting a booking would cause a conflict with an already-confirmed booking.
 * Returns true if there IS a conflict (should NOT accept).
 */
export async function hasConfirmedOverlap(
  bookableShelterDbId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string | null
): Promise<boolean> {
  let query = createAdminClient()
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("status", "confirmed")
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

/**
 * Returns true if the requested date range overlaps an existing booking
 * (pending and/or confirmed) or a manually blocked date.
 */
export async function hasUnavailableOverlap(
  bookableShelterDbId: string,
  checkIn: string,
  checkOut: string,
  opts?: {
    includePending?: boolean;
    excludeBookingId?: string | null;
  }
): Promise<boolean> {
  const includePending = opts?.includePending ?? true;
  const statuses = includePending ? ["pending", "confirmed"] : ["confirmed"];

  let bookingQuery = createAdminClient()
      .from("shelter_bookings")
      .select("id")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .in("status", statuses)
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);
  if (opts?.excludeBookingId) {
    bookingQuery = bookingQuery.neq("id", opts.excludeBookingId);
  }

  const [bookingOverlap, blockedOverlap] = await Promise.all([
    bookingQuery,
    createAdminClient()
      .from("shelter_blocked_dates")
      .select("blocked_date")
      .eq("bookable_shelter_id", bookableShelterDbId)
      .gte("blocked_date", checkIn)
      .lt("blocked_date", checkOut)
      .limit(1),
  ]);

  return (bookingOverlap.data?.length ?? 0) > 0 || (blockedOverlap.data?.length ?? 0) > 0;
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

/** Look up a booking by its guest_token UUID (guest page auth). */
export async function getBookingByGuestToken(
  guestToken: string
): Promise<ShelterBooking | null> {
  const { data } = await createAdminClient()
    .from("shelter_bookings")
    .select("*")
    .eq("guest_token", guestToken)
    .maybeSingle();
  return data as ShelterBooking | null;
}

/**
 * Mark a booking as cancelled. Only succeeds if current status is 'confirmed'
 * (race-condition safe — concurrent requests get 409 from the API).
 * Returns true if the row was actually updated (false = already not confirmed).
 */
export async function cancelBooking(
  bookingId: string,
  cancelledBy: "owner" | "guest" | "system"
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("shelter_bookings")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_by: cancelledBy,
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");
  if (error) throw new Error("cancelBooking: " + error.message);
  return (data ?? []).length > 0;
}

/** Look up a bookable shelter by its primary key (id). */
export async function getBookableShelterByPk(
  id: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
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
  const { error } = await createAdminClient()
    .from("shelter_blocked_dates")
    .delete()
    .eq("bookable_shelter_id", bookableShelterDbId)
    .eq("source", "ical_sync");
  if (error) throw new Error(`deleteIcalSyncedDates: ${error.message}`);
}

export async function blockDatesFromSync(
  bookableShelterDbId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) return;
  const supabase = createAdminClient();
  const chunkSize = 500;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("shelter_blocked_dates")
      .upsert(
        chunk.map((d) => ({
          bookable_shelter_id: bookableShelterDbId,
          blocked_date: d,
          source: "ical_sync",
        }))
      );
    if (error) throw new Error(`blockDatesFromSync: ${error.message}`);
  }
}
