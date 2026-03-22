const R = 6371; // Earth radius in km

export function haversineKm(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function estimateWalkingHours(km: number): number {
  return km / 5;
}

export function formatWalkingTime(hours: number): string {
  if (hours < 1) return `~${Math.round(hours * 60)} min`;
  return `~${hours.toFixed(1)} t`;
}
