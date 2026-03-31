// Types
export type { Shelter } from "./types/shelter";
export type {
  RouteShelter,
  CuratedRouteIndex,
  CuratedRouteData,
  CuratedRouteDataMap,
} from "./types/curated-route";

// Utilities
export {
  slugifySegment,
  slugifySegmentLegacy,
  segmentSlugToName,
} from "./lib/slug";

export {
  haversineKm,
  formatDistance,
  estimateWalkingHours,
  formatWalkingTime,
} from "./lib/haversine";

export { formatRelativeTimeDa } from "./lib/relative-time-da";

export { filterSheltersByRegion } from "./lib/soeg-filters";

export {
  prepositionForArea,
  prepositionForRegionName,
} from "./lib/area-prepositions";

export type { GpxWaypoint } from "./lib/gpx-export";
export { generateGpx, generateRouteGpx } from "./lib/gpx-export";

// shelter-detail exports are numerous — import directly from @shared/lib/shelter-detail
