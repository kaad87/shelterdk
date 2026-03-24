// lib/shelter-distance.ts

import type { GpxTrackPoint } from "./gpx-parser";

export interface ShelterWithDistance {
  id: string;
  title: string;
  slug: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export interface LightShelter {
  id: string;
  title: string;
  slug: string;
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in km between two lat/lon points. */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find shelters within `radiusKm` of any point on the route.
 * For long routes (>1000 points), samples every 5th point for performance.
 * Returns shelters sorted by distance (closest first).
 */
export function findSheltersNearRoute(
  routePoints: GpxTrackPoint[],
  shelters: LightShelter[],
  radiusKm: number
): ShelterWithDistance[] {
  if (routePoints.length === 0 || shelters.length === 0) return [];

  // Sample route points for performance on long routes
  const sampleInterval = routePoints.length > 1000 ? 5 : 1;
  const sampledPoints: GpxTrackPoint[] = [];
  for (let i = 0; i < routePoints.length; i += sampleInterval) {
    sampledPoints.push(routePoints[i]);
  }
  // Always include the last point
  const lastPoint = routePoints[routePoints.length - 1];
  if (sampledPoints[sampledPoints.length - 1] !== lastPoint) {
    sampledPoints.push(lastPoint);
  }

  const results: ShelterWithDistance[] = [];

  for (const shelter of shelters) {
    let minDist = Infinity;

    for (const pt of sampledPoints) {
      const dist = haversineDistance(pt.lat, pt.lon, shelter.lat, shelter.lon);
      if (dist < minDist) {
        minDist = dist;
      }
      // Early exit if already very close
      if (minDist < 0.1) break;
    }

    if (minDist <= radiusKm) {
      results.push({
        id: shelter.id,
        title: shelter.title,
        slug: shelter.slug,
        lat: shelter.lat,
        lon: shelter.lon,
        distanceKm: Math.round(minDist * 10) / 10,
      });
    }
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}
