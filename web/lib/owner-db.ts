import { createAdminClient } from "@/utils/supabase/server-admin";
import type { BookableShelter } from "@/types/booking";
import type { Shelter } from "@shared/types/shelter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const BUCKET = "shelter-photos";

// ─── Dashboard summary ───────────────────────────────────────────────────────

export interface DashboardShelterSummary {
  shelterId: string;
  /** Pending bookings that need the owner's response (after_confirmation mode). */
  pendingCount: number;
  /** Soonest upcoming confirmed check-in, if any. */
  nextCheckIn: { date: string; guestName: string } | null;
}

/**
 * Returns pending-count and next-check-in for a set of bookable shelter IDs.
 * Uses two batched IN queries rather than N individual queries.
 */
export async function getDashboardSummaries(
  shelterIds: string[],
  ownerResponseShelterIds: string[] = shelterIds
): Promise<DashboardShelterSummary[]> {
  if (shelterIds.length === 0) return [];
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [pendingResult, upcomingResult] = await Promise.all([
    ownerResponseShelterIds.length > 0
      ? supabase
          .from("shelter_bookings")
          .select("bookable_shelter_id")
          .in("bookable_shelter_id", ownerResponseShelterIds)
          .eq("status", "pending")
          .gte("check_out", today)
      : Promise.resolve({ data: [] as { bookable_shelter_id: string }[] }),
    supabase
      .from("shelter_bookings")
      .select("bookable_shelter_id, check_in, guest_name")
      .in("bookable_shelter_id", shelterIds)
      .eq("status", "confirmed")
      .gte("check_in", today)
      .order("check_in", { ascending: true }),
  ]);

  const pendingCounts: Record<string, number> = {};
  for (const b of pendingResult.data ?? []) {
    pendingCounts[b.bookable_shelter_id] = (pendingCounts[b.bookable_shelter_id] ?? 0) + 1;
  }

  const nextCheckIns: Record<string, { date: string; guestName: string }> = {};
  for (const b of upcomingResult.data ?? []) {
    if (!nextCheckIns[b.bookable_shelter_id]) {
      nextCheckIns[b.bookable_shelter_id] = { date: b.check_in, guestName: b.guest_name };
    }
  }

  return shelterIds.map((id) => ({
    shelterId: id,
    pendingCount: pendingCounts[id] ?? 0,
    nextCheckIn: nextCheckIns[id] ?? null,
  }));
}

// ─── Shelter lookup ──────────────────────────────────────────────────────────

/**
 * Returns all bookable_shelters owned by the given auth user, plus
 * active booking count for each (confirmed bookings with check_out >= today).
 */
export async function getSheltersByAuthUser(
  authUserId: string
): Promise<Array<BookableShelter & { active_booking_count: number }>> {
  const supabase = createAdminClient();

  const { data: shelters } = await supabase
    .from("bookable_shelters")
    .select("*")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: true });

  if (!shelters?.length) return [];

  const today = new Date().toISOString().slice(0, 10);
  const shelterIds = shelters.map((s) => s.id);

  // Single batched query instead of N individual count queries.
  const { data: bookingRows } = await supabase
    .from("shelter_bookings")
    .select("bookable_shelter_id")
    .in("bookable_shelter_id", shelterIds)
    .eq("status", "confirmed")
    .gte("check_out", today);

  const countMap: Record<string, number> = {};
  for (const row of bookingRows ?? []) {
    countMap[row.bookable_shelter_id] = (countMap[row.bookable_shelter_id] ?? 0) + 1;
  }

  return shelters.map((s) => ({
    ...s,
    active_booking_count: countMap[s.id] ?? 0,
  }));
}

/**
 * Returns a single bookable_shelter if it belongs to the given auth user.
 * Returns null if not found OR if the shelter belongs to a different user.
 */
export async function getOwnerShelterById(
  shelterId: string,
  authUserId: string
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("id", shelterId)
    .eq("auth_user_id", authUserId)
    .single();
  return data ?? null;
}

/**
 * Returns all bookable shelters in the same shelter group (same shelters.id FK)
 * for the given auth user. Used for shared settings across multi-unit places.
 */
export async function getShelterGroupByDbShelterId(
  shelterDbId: string,
  authUserId: string
): Promise<BookableShelter[]> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .eq("auth_user_id", authUserId)
    .eq("shelter_id", shelterDbId)
    .order("title", { ascending: true });
  return (data ?? []) as BookableShelter[];
}

export async function getSharedShelterContent(
  shelterDbId: string
): Promise<Shelter | null> {
  const { data } = await createAdminClient()
    .from("shelters")
    .select("id, title, slug, description, image_url, image_urls, user_image_urls, water, toilet, geofa_raw, photo_order")
    .eq("id", shelterDbId)
    .single();
  return (data as Shelter | null) ?? null;
}

export async function updateSharedShelterContent(
  shelterDbId: string,
  fields: {
    description?: string | null;
    user_image_urls?: string[] | null;
    water?: boolean | null;
    toilet?: "flush" | "mulch" | "none" | "unknown" | null;
    geofa_raw?: Record<string, unknown> | null;
    photo_order?: string[] | null;
  }
): Promise<Shelter | null> {
  const { data } = await createAdminClient()
    .from("shelters")
    .update(fields)
    .eq("id", shelterDbId)
    .select("id, title, slug, description, image_url, image_urls, user_image_urls, water, toilet, geofa_raw, photo_order")
    .single();
  return (data as Shelter | null) ?? null;
}

// ─── Shelter update ──────────────────────────────────────────────────────────

export interface OwnerShelterUpdate {
  title?: string;
  description?: string;
  max_persons?: number;
  shelter_price_dkk?: number | null;
}

/**
 * Updates allowed owner-editable fields on bookable_shelters.
 * Note: bookable_shelters has no updated_at column — do not include it.
 */
export async function updateOwnerShelter(
  shelterId: string,
  fields: OwnerShelterUpdate
): Promise<BookableShelter | null> {
  const { data } = await createAdminClient()
    .from("bookable_shelters")
    .update({ ...fields })
    .eq("id", shelterId)
    .select("*")
    .single();
  return data ?? null;
}

// ─── Photo helpers ───────────────────────────────────────────────────────────

/**
 * Returns the user_image_urls array for the main shelter record.
 * shelterDbId is bookable_shelters.shelter_id (the shelters.id FK).
 */
export async function getShelterPhotos(shelterDbId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("shelters")
    .select("user_image_urls")
    .eq("id", shelterDbId)
    .single();
  const urls = data?.user_image_urls;
  return Array.isArray(urls) ? (urls as string[]) : [];
}

/**
 * Appends a public image URL to shelters.user_image_urls[].
 */
export async function appendShelterPhoto(
  shelterDbId: string,
  url: string
): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc("append_user_image_url", {
    p_shelter_id: shelterDbId,
    p_url: url,
  });
  if (error) throw new Error(`appendShelterPhoto: ${error.message}`);
  return Array.isArray(data) ? (data as string[]) : [];
}

/**
 * Removes a public image URL from shelters.user_image_urls[] by exact match.
 */
export async function removeShelterPhoto(
  shelterDbId: string,
  url: string
): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc("remove_user_image_url", {
    p_shelter_id: shelterDbId,
    p_url: url,
  });
  if (error) throw new Error(`removeShelterPhoto: ${error.message}`);
  return Array.isArray(data) ? (data as string[]) : [];
}

/**
 * Returns the public URL for a file stored in the shelter-photos bucket.
 */
export function shelterPhotoUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

/**
 * Extracts the storage path from a public shelter-photos URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
export function extractPhotoPath(url: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

/**
 * Validates that a storage path belongs to the given shelter.
 * Prevents owners from deleting other shelters' photos.
 */
export function isOwnerPhotoPath(path: string, shelterDbId: string): boolean {
  return path.startsWith(`owner/${shelterDbId}/`);
}
