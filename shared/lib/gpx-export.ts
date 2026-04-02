export interface GpxWaypoint {
  name: string;
  lat: number;
  lon: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateGpx(waypoints: GpxWaypoint[]): string {
  if (waypoints.length === 0) return "";

  const wptElements = waypoints
    .map(
      (w) =>
        `  <wpt lat="${w.lat}" lon="${w.lon}">\n    <name>${escapeXml(w.name)}</name>\n  </wpt>`
    )
    .join("\n");

  let trkElement = "";
  if (waypoints.length > 1) {
    const trkpts = waypoints
      .map((w) => `      <trkpt lat="${w.lat}" lon="${w.lon}" />`)
      .join("\n");
    trkElement = `\n  <trk>\n    <name>Min shelter-rute</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ShelterDK Ruteplanner" xmlns="http://www.topografix.com/GPX/1/1">\n${wptElements}${trkElement}\n</gpx>`;
}

/**
 * Generate GPX from a named route with GeoJSON track geometry and shelter waypoints.
 */
export function generateRouteGpx(
  routeName: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): string {
  const wptElements = shelterWaypoints
    .map(
      (w) =>
        `  <wpt lat="${w.lat}" lon="${w.lon}">\n    <name>${escapeXml(w.name)}</name>\n  </wpt>`
    )
    .join("\n");

  const lineArrays =
    trackGeometry.type === "MultiLineString"
      ? trackGeometry.coordinates
      : [trackGeometry.coordinates];

  const trksegs = lineArrays
    .map((line) => {
      const pts = line
        .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}" />`)
        .join("\n");
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join("\n");

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="ShelterDK Ruteplanner" xmlns="http://www.topografix.com/GPX/1/1">',
  ];
  if (wptElements) parts.push(wptElements);
  parts.push(`  <trk>\n    <name>${escapeXml(routeName)}</name>\n${trksegs}\n  </trk>`);
  parts.push("</gpx>");

  return parts.join("\n");
}
