import { createCacheableAdminClient } from "@/utils/supabase/server-admin";

/**
 * Førsteparts gæste-anmeldelser (efter verificeret ophold booket via ShelterDK).
 * Skrives KUN via /api/anmeld/[guestToken] (service_role) — én pr. booking.
 */

export interface GuestReview {
  id: string;
  rating: number;
  comment: string | null;
  guest_name: string;
  created_at: string;
}

/** Publicerede anmeldelser til shelter-detaljesiden (server-renderes). */
export async function getPublishedGuestReviews(
  shelterId: string,
  limit = 10
): Promise<GuestReview[]> {
    // Cachebar variant: publicerede anmeldelser ændrer sig sjældent, og
  // no-store-varianten tvang hele shelter-siden dynamisk.
  const { data } = await createCacheableAdminClient()
    .from("shelter_guest_reviews")
    .select("id, rating, comment, guest_name, created_at")
    .eq("shelter_id", shelterId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as GuestReview[];
}

/** Fornavn + efternavns-initial ("Camilla Hansen" → "Camilla H."). */
export function displayGuestName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "Gæst";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
