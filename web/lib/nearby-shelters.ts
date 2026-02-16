/**
 * Hent nærmeste shelters via PostGIS RPC get_nearby_shelters.
 * Kræver migration 019_nearby_shelters_rpc.sql (PostGIS + funktion).
 */

import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";

export interface NearbyShelter extends Shelter {
  distance_km: number;
}

const RPC_NAME = "get_nearby_shelters";

const RPC_NEARBY_WITHIN_RADIUS = "get_nearby_shelters_within_radius";

/** Returnerer op til 5 nærmeste shelters (ekskl. excludeId). distance_km i km. */
export async function getNearbyShelters(
  lat: number,
  lng: number,
  excludeId: string,
  limit: number = 5
): Promise<NearbyShelter[]> {
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
}

/** Returnerer op til limit nærmeste shelters inden for radius_km (default 15 km). Kræver migration 021. */
export async function getNearbySheltersWithinRadius(
  shelterId: string,
  radiusKm: number = 15,
  limit: number = 3
): Promise<NearbyShelter[]> {
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
}
