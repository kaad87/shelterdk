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

export function downloadGpx(waypoints: GpxWaypoint[]): void {
  const gpx = generateGpx(waypoints);
  if (!gpx) return;
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shelterdk-rute.gpx";
  a.click();
  URL.revokeObjectURL(url);
}
