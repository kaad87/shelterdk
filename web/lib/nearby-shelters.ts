/**
 * Hent nærmeste shelters via PostGIS RPC get_nearby_shelters.
 * Kræver migration 019_nearby_shelters_rpc.sql (PostGIS + funktion).
 */

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";

export interface NearbyShelter extends Shelter {
  distance_km: number;
}

const RPC_NAME = "get_nearby_shelters";

const RPC_NEARBY_WITHIN_RADIUS = "get_nearby_shelters_within_radius";

// "Nærliggende shelters" er rene geo-opslag, der kun ændrer sig når shelters
// tilføjes/flyttes (sjældent, insert-only import). De renderes allerede på en
// 24t-ISR-side, så cachet i 24t giver ingen ekstra staleness men sparer DB'en for
// ~765k RPC-kald/106 dage (top-driver bag egress-overforbrug + statement-timeouts).
const NEARBY_REVALIDATE_SECONDS = 86400;

const cachedNearbyShelters = unstable_cache(
  async (lat: number, lng: number, excludeId: string, limit: number): Promise<NearbyShelter[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc(RPC_NAME, {
      p_lat: lat,
      p_lng: lng,
      p_exclude_id: excludeId,
      p_limit: limit,
    });
    if (error) {
      console.error("get_nearby_shelters RPC error:", error);
      return [];
    }
    return (data ?? []) as NearbyShelter[];
  },
  ["get-nearby-shelters"],
  { revalidate: NEARBY_REVALIDATE_SECONDS }
);

const cachedNearbyWithinRadius = unstable_cache(
  async (shelterId: string, radiusKm: number, limit: number): Promise<NearbyShelter[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc(RPC_NEARBY_WITHIN_RADIUS, {
      p_shelter_id: shelterId,
      p_radius_km: radiusKm,
      p_limit: limit,
    });
    if (error) {
      console.error("get_nearby_shelters_within_radius RPC error:", error);
      return [];
    }
    return (data ?? []) as NearbyShelter[];
  },
  ["get-nearby-shelters-within-radius"],
  { revalidate: NEARBY_REVALIDATE_SECONDS }
);

/** Returnerer op til 5 nærmeste shelters (ekskl. excludeId). distance_km i km. Cachet 24t. */
export async function getNearbyShelters(
  lat: number,
  lng: number,
  excludeId: string,
  limit: number = 5
): Promise<NearbyShelter[]> {
  return cachedNearbyShelters(lat, lng, excludeId, limit);
}

/** Returnerer op til limit nærmeste shelters inden for radius_km (default 15 km). Cachet 24t. */
export async function getNearbySheltersWithinRadius(
  shelterId: string,
  radiusKm: number = 15,
  limit: number = 3
): Promise<NearbyShelter[]> {
  return cachedNearbyWithinRadius(shelterId, radiusKm, limit);
}
