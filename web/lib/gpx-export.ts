export { generateGpx, generateRouteGpx } from "@shared/lib/gpx-export";
export type { GpxWaypoint } from "@shared/lib/gpx-export";

import { generateGpx as _generateGpx, generateRouteGpx as _generateRouteGpx } from "@shared/lib/gpx-export";
import type { GpxWaypoint } from "@shared/lib/gpx-export";

export function downloadGpx(waypoints: GpxWaypoint[]): void {
  const gpx = _generateGpx(waypoints);
  if (!gpx) return;
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shelterdk-rute.gpx";
  a.click();
  URL.revokeObjectURL(url);
}

/** Download GPX for a curated route. */
export function downloadRouteGpx(
  routeName: string,
  slug: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): void {
  const gpx = _generateRouteGpx(routeName, trackGeometry, shelterWaypoints);
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
