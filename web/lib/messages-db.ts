import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookingMessage } from "@/types/booking";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns null if body is valid, or a Danish error message string.
 * Exported for testing and used by API routes.
 */
export function validateMessageBody(body: unknown): string | null {
  if (typeof body !== "string" || body.trim().length === 0)
    return "Beskeden må ikke være tom";
  if (body.length > 2000)
    return "Beskeden er for lang (maks. 2000 tegn)";
  return null;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Returns all messages for a booking, oldest first. */
export async function getMessagesForBooking(
  bookingId: string
): Promise<BookingMessage[]> {
  const { data } = await createAdminClient()
    .from("booking_messages")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  return (data ?? []) as BookingMessage[];
}

/** Inserts a new message row and returns it. */
export async function createMessage(
  bookingId: string,
  sender: "guest" | "owner",
  body: string
): Promise<BookingMessage> {
  const { data, error } = await createAdminClient()
    .from("booking_messages")
    .insert({ booking_id: bookingId, sender, body })
    .select()
    .single();
  if (error || !data) throw new Error("createMessage: " + error?.message);
  return data as BookingMessage;
}

/**
 * Marks all messages sent BY senderToMark as read (by the other party).
 * E.g. owner opens thread → markMessagesRead(id, "guest") marks the guest's
 * unread messages as read by the owner.
 */
export async function markMessagesRead(
  bookingId: string,
  senderToMark: "guest" | "owner"
): Promise<void> {
  await createAdminClient()
    .from("booking_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("sender", senderToMark)
    .is("read_at", null);
}

/**
 * Returns { bookingId → unreadCount } for all active bookings of a shelter.
 * Counts only unread messages sent by guests (not yet read by owner).
 * Uses two queries to avoid a complex join.
 */
export async function getUnreadCountsForShelter(
  bookableShelterDbId: string
): Promise<Record<string, number>> {
  // Step 1: get active booking IDs for this shelter
  const { data: bookingRows } = await createAdminClient()
    .from("shelter_bookings")
    .select("id")
    .eq("bookable_shelter_id", bookableShelterDbId)
    .in("status", ["pending", "confirmed"]);

  if (!bookingRows?.length) return {};

  const ids = bookingRows.map((b) => b.id as string);

  // Step 2: count unread guest messages per booking
  const { data: msgRows } = await createAdminClient()
    .from("booking_messages")
    .select("booking_id")
    .in("booking_id", ids)
    .eq("sender", "guest")
    .is("read_at", null);

  const counts: Record<string, number> = {};
  for (const row of msgRows ?? []) {
    counts[row.booking_id] = (counts[row.booking_id] ?? 0) + 1;
  }
  return counts;
}
