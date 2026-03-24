// lib/gpx-parser.ts

export interface GpxTrackPoint {
  lat: number;
  lon: number;
}

export interface ParsedGpx {
  name: string | null;
  points: GpxTrackPoint[];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Parse a GPX file (client-side) and extract track/route points.
 * Supports <trkpt> (tracks) and <rtept> (routes).
 */
export function parseGpxFile(file: File): Promise<ParsedGpx> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error("Filen er for stor (max 5 MB)"));
      return;
    }

    if (!file.name.toLowerCase().endsWith(".gpx")) {
      reject(new Error("Filen skal være en .gpx fil"));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Kunne ikke læse filen"));

    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");

        // Check for XML parse errors
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
          reject(new Error("Ugyldig GPX-fil \u2014 filen kunne ikke l\u00e6ses"));
          return;
        }

        const points: GpxTrackPoint[] = [];

        // Extract trackpoints (<trkpt>)
        const trkpts = doc.getElementsByTagName("trkpt");
        for (let i = 0; i < trkpts.length; i++) {
          const pt = trkpts[i];
          const lat = parseFloat(pt.getAttribute("lat") || "");
          const lon = parseFloat(pt.getAttribute("lon") || "");
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            points.push({ lat, lon });
          }
        }

        // If no trackpoints, try routepoints (<rtept>)
        if (points.length === 0) {
          const rtepts = doc.getElementsByTagName("rtept");
          for (let i = 0; i < rtepts.length; i++) {
            const pt = rtepts[i];
            const lat = parseFloat(pt.getAttribute("lat") || "");
            const lon = parseFloat(pt.getAttribute("lon") || "");
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              points.push({ lat, lon });
            }
          }
        }

        if (points.length === 0) {
          reject(
            new Error("Ingen rute-data fundet i GPX-filen. Filen skal indeholde trackpoints.")
          );
          return;
        }

        // Try to extract route name
        const nameEl =
          doc.getElementsByTagName("name")[0] ??
          doc.querySelector("trk > name") ??
          doc.querySelector("rte > name");
        const name = nameEl?.textContent?.trim() || null;

        resolve({ name, points });
      } catch {
        reject(new Error("Kunne ikke parse GPX-filen"));
      }
    };

    reader.readAsText(file);
  });
}
