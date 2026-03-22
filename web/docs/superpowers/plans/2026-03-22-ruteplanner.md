# Ruteplanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive route planner page (`/ruteplanner`) where users click shelters on a map to build a hiking route, optionally view GeoFA hiking trails, and export their route as GPX.

**Architecture:** New standalone page with a Leaflet map + sidebar. All shelter data is fetched server-side and passed as props. Trail data is a static JSON file fetched lazily on toggle. URL is the single source of truth for route state. No new database tables.

**Tech Stack:** Next.js 14 App Router, React 18, Leaflet/react-leaflet, Supabase, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-ruteplanner-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/haversine.ts` | Pure function: haversine distance between two lat/lon points |
| `lib/gpx-export.ts` | Pure function: generate GPX XML string from waypoints array |
| `lib/__tests__/haversine.test.ts` | Tests for haversine |
| `lib/__tests__/gpx-export.test.ts` | Tests for GPX export |
| `components/RoutePlannerSidebar.tsx` | Sidebar: waypoint list, reorder, summary, action buttons |
| `components/RoutePlannerMap.tsx` | Leaflet map: markers, route polyline, trail overlay (dynamic import) |
| `components/RoutePlannerClient.tsx` | Client wrapper: state management, URL sync, coordinates map + sidebar |
| `app/(site)/ruteplanner/page.tsx` | Server component: fetch shelters, metadata, Suspense boundary |
| `scripts/import-geofa-trails.ts` | Build script: fetch GeoFA trails → `public/data/trails.json` |

### Modified Files

| File | Change |
|------|--------|
| `components/Navbar.tsx` | Add "Ruteplanner" link to `navLinks` array |
| `app/sitemap.ts` | Add `/ruteplanner` to `STATIC_PAGES` array |
| `app/globals.css` | Add `.waypoint-marker` and `.trail-tooltip` CSS classes |
| `types/shelter.ts` | Add optional `capacity` field to `Shelter` interface |

---

## Task 1: Haversine Distance Utility

**Files:**
- Create: `lib/haversine.ts`
- Create: `lib/__tests__/haversine.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// lib/__tests__/haversine.test.ts
import { describe, it, expect } from "vitest";
import { haversineKm, formatDistance, formatWalkingTime, estimateWalkingHours } from "@/lib/haversine";

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(56.0, 10.0, 56.0, 10.0)).toBe(0);
  });

  it("calculates Copenhagen to Aarhus ~187 km", () => {
    const d = haversineKm(55.6761, 12.5683, 56.1629, 10.2039);
    expect(d).toBeGreaterThan(180);
    expect(d).toBeLessThan(195);
  });

  it("calculates short distance accurately", () => {
    // ~1.11 km north
    const d = haversineKm(56.0, 10.0, 56.01, 10.0);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});

describe("formatDistance", () => {
  it("formats km values", () => {
    expect(formatDistance(12.34)).toBe("12.3 km");
    expect(formatDistance(1.0)).toBe("1.0 km");
  });

  it("formats sub-km as meters", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(0.1)).toBe("100 m");
  });
});

describe("formatWalkingTime", () => {
  it("formats hours", () => {
    expect(formatWalkingTime(4.2)).toBe("~4.2 t");
  });

  it("formats sub-hour as minutes", () => {
    expect(formatWalkingTime(0.5)).toBe("~30 min");
  });
});

describe("estimateWalkingHours", () => {
  it("estimates at 5 km/h", () => {
    expect(estimateWalkingHours(10)).toBe(2);
    expect(estimateWalkingHours(25)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/haversine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// lib/haversine.ts
const R = 6371; // Earth radius in km

export function haversineKm(
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format km for display: "12.3 km" or "850 m" for <1 km */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Estimate walking time in hours at 5 km/h */
export function estimateWalkingHours(km: number): number {
  return km / 5;
}

/** Format hours for display: "~4.2 t" */
export function formatWalkingTime(hours: number): string {
  if (hours < 1) return `~${Math.round(hours * 60)} min`;
  return `~${hours.toFixed(1)} t`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/haversine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add lib/haversine.ts lib/__tests__/haversine.test.ts && git commit -m "feat(ruteplanner): add haversine distance utility with tests"
```

---

## Task 2: GPX Export Utility

**Files:**
- Create: `lib/gpx-export.ts`
- Create: `lib/__tests__/gpx-export.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// lib/__tests__/gpx-export.test.ts
import { describe, it, expect } from "vitest";
import { generateGpx } from "@/lib/gpx-export";

describe("generateGpx", () => {
  it("returns empty string for no waypoints", () => {
    expect(generateGpx([])).toBe("");
  });

  it("generates valid GPX with wpt and trk elements", () => {
    const waypoints = [
      { name: "Shelter A", lat: 56.178, lon: 10.055 },
      { name: "Shelter B", lat: 56.312, lon: 10.201 },
    ];
    const gpx = generateGpx(waypoints);

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain("ShelterDK Ruteplanner");
    // wpt elements
    expect(gpx).toContain('<wpt lat="56.178" lon="10.055">');
    expect(gpx).toContain("<name>Shelter A</name>");
    expect(gpx).toContain('<wpt lat="56.312" lon="10.201">');
    // trk with trkseg
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain('<trkpt lat="56.178" lon="10.055"');
    expect(gpx).toContain('<trkpt lat="56.312" lon="10.201"');
  });

  it("escapes XML special characters in names", () => {
    const waypoints = [
      { name: 'Shelter "Uglen" & Co', lat: 56.0, lon: 10.0 },
    ];
    const gpx = generateGpx(waypoints);
    expect(gpx).toContain("&amp;");
    expect(gpx).toContain("&quot;");
    expect(gpx).not.toContain('& Co');
  });

  it("generates single waypoint without trk", () => {
    const waypoints = [{ name: "Solo", lat: 56.0, lon: 10.0 }];
    const gpx = generateGpx(waypoints);
    expect(gpx).toContain("<wpt");
    // A single waypoint has no track (no line to draw)
    expect(gpx).not.toContain("<trk>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/gpx-export.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// lib/gpx-export.ts
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

/** Trigger browser download of GPX file */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/gpx-export.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add lib/gpx-export.ts lib/__tests__/gpx-export.test.ts && git commit -m "feat(ruteplanner): add GPX export utility with tests"
```

---

## Task 3: Add `capacity` to Shelter Type

**Files:**
- Modify: `types/shelter.ts`

- [ ] **Step 1: Add capacity field**

Add after the `water` field (line 28) in `types/shelter.ts`:

```typescript
  /** Antal pladser/sovepladser. */
  capacity?: number | null;
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors (existing errors may exist)

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add types/shelter.ts && git commit -m "feat: add capacity field to Shelter type"
```

---

## Task 4: Waypoint Marker CSS + Trail Tooltip CSS

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add CSS classes at the end of globals.css**

```css
/* Ruteplanner – numbered waypoint markers */
.waypoint-marker {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #C5A059;
  color: white;
  font-family: var(--font-dm-sans), system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2.5px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

/* Ruteplanner – trail name tooltip */
.trail-tooltip {
  background: white !important;
  border: 1px solid rgba(44, 62, 80, 0.1) !important;
  border-radius: 0.5rem !important;
  padding: 0.5rem 0.75rem !important;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
  font-family: var(--font-dm-sans), system-ui, sans-serif;
}
.trail-tooltip::before {
  display: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add app/globals.css && git commit -m "feat(ruteplanner): add waypoint marker and trail tooltip CSS"
```

---

## Task 5: RoutePlannerSidebar Component

**Files:**
- Create: `components/RoutePlannerSidebar.tsx`

This is a pure presentational component — receives waypoints and callbacks as props.

- [ ] **Step 1: Create the component**

```typescript
// components/RoutePlannerSidebar.tsx
"use client";

import {
  MapPin,
  ChevronUp,
  ChevronDown,
  X,
  Download,
  Share2,
  Trash2,
  Footprints,
} from "lucide-react";
import { haversineKm, formatDistance, estimateWalkingHours, formatWalkingTime } from "@/lib/haversine";
import { getLocationCoords } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";
import { useState } from "react";

interface Props {
  waypoints: Shelter[];
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClear: () => void;
  onDownloadGpx: () => void;
  onShare: () => void;
}

export function RoutePlannerSidebar({
  waypoints,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
  onDownloadGpx,
  onShare,
}: Props) {
  const [copied, setCopied] = useState(false);

  // Calculate distances between consecutive waypoints
  const distances: number[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const a = getLocationCoords(waypoints[i - 1]);
    const b = getLocationCoords(waypoints[i]);
    if (a && b) {
      distances.push(haversineKm(a.lat, a.lon, b.lat, b.lon));
    } else {
      distances.push(0);
    }
  }
  const totalKm = distances.reduce((s, d) => s + d, 0);
  const walkingHours = estimateWalkingHours(totalKm);

  const handleShare = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const hasWaypoints = waypoints.length > 0;

  return (
    <div className="bg-white p-5 overflow-y-auto h-full flex flex-col">
      <h1 className="font-serif text-xl font-semibold text-primary mb-4">
        Ruteplanner
      </h1>

      {!hasWaypoints ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <MapPin size={48} className="text-primary/20 mb-3" />
          <p className="text-sm text-primary/50 text-center max-w-[200px]">
            Klik på et shelter på kortet for at starte din rute
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {waypoints.map((shelter, i) => {
              const coords = getLocationCoords(shelter);
              return (
                <div key={shelter.id}>
                  <div className="flex items-start gap-3 py-3 border-b border-primary/5">
                    {/* Number badge */}
                    <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>

                    {/* Shelter info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {shelter.title}
                      </p>
                      <div className="text-xs text-primary/40 flex items-center gap-2 mt-0.5">
                        {shelter.capacity && (
                          <span>{shelter.capacity} pl.</span>
                        )}
                        {shelter.water && <span>Vand</span>}
                        {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && (
                          <span>Toilet</span>
                        )}
                      </div>
                    </div>

                    {/* Reorder + remove buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => onMoveUp(i)}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-primary/5 text-primary/30 hover:text-primary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="Flyt op"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => onMoveDown(i)}
                        disabled={i === waypoints.length - 1}
                        className="p-1 rounded hover:bg-primary/5 text-primary/30 hover:text-primary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="Flyt ned"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={() => onRemove(i)}
                        className="p-1 rounded hover:bg-red-50 text-primary/30 hover:text-red-400 transition-colors"
                        aria-label="Fjern"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Distance to next waypoint */}
                  {i < distances.length && (
                    <div className="text-xs text-primary/40 pl-9 py-1 border-l border-dashed border-primary/15 ml-3">
                      {formatDistance(distances[i])}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <Footprints size={16} className="text-primary/40" />
              <span className="text-lg font-semibold text-primary">
                {formatDistance(totalKm)}
              </span>
              <span className="text-primary/30 mx-1">·</span>
              <span className="text-sm text-primary/50">
                {formatWalkingTime(walkingHours)}
              </span>
            </div>

            {/* Primary button */}
            <button
              onClick={onDownloadGpx}
              disabled={!hasWaypoints}
              className="w-full mt-4 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download size={16} />
              Download GPX
            </button>

            {/* Secondary buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleShare}
                disabled={!hasWaypoints}
                className="flex-1 py-2 rounded-xl border border-primary/15 text-primary/70 text-sm font-medium hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Share2 size={14} />
                {copied ? "Kopieret!" : "Del rute"}
              </button>
              <button
                onClick={onClear}
                className="py-2 px-4 rounded-xl text-sm text-primary/40 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                Ryd
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep -i "RoutePlannerSidebar" | head -5`
Expected: No errors mentioning this file (some unrelated errors may exist)

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RoutePlannerSidebar.tsx && git commit -m "feat(ruteplanner): add sidebar component with waypoint list and actions"
```

---

## Task 6: RoutePlannerMap Component

**Files:**
- Create: `components/RoutePlannerMap.tsx`

This is the Leaflet map component. Must be dynamically imported (Leaflet requires browser). Uses `react-leaflet` for map, markers, and polyline. Adds GeoJSON trail layer on toggle.

- [ ] **Step 1: Create the map component**

```typescript
// components/RoutePlannerMap.tsx
"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  GeoJSON,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Route } from "lucide-react";
import { getLocationCoords } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";

// Use same icon pattern as existing ShelterMap.tsx — static files from /public/leaflet/
const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Escape HTML entities for safe insertion into Leaflet tooltip HTML */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DEFAULT_CENTER: [number, number] = [56.2639, 9.5018];
const DEFAULT_ZOOM = 7;

const ROUTE_LINE_OPTIONS = {
  color: "#C5A059",
  weight: 3,
  opacity: 0.8,
  dashArray: "8, 6",
  lineCap: "round" as const,
};

const TRAIL_STYLE = {
  color: "#2d6a4f",
  weight: 2.5,
  opacity: 0.45,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Geometry;
}

interface Props {
  shelters: Shelter[];
  waypoints: Shelter[];
  onToggleShelter: (shelter: Shelter) => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  trailData: Trail[] | null;
}

function createWaypointIcon(num: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="waypoint-marker">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Inner component that can use useMap() hook */
function MapContent({
  shelters,
  waypoints,
  onToggleShelter,
  showTrails,
  trailData,
}: Omit<Props, "onToggleTrails">) {
  const waypointIds = useMemo(
    () => new Set(waypoints.map((w) => w.id)),
    [waypoints]
  );

  // Build route line positions
  const routePositions = useMemo(() => {
    return waypoints
      .map((w) => getLocationCoords(w))
      .filter(Boolean)
      .map((c) => [c!.lat, c!.lon] as [number, number]);
  }, [waypoints]);

  // Memoize shelter markers with coordinates
  const sheltersWithCoords = useMemo(() => {
    return shelters
      .map((s) => {
        const coords = getLocationCoords(s);
        if (!coords) return null;
        return { shelter: s, coords };
      })
      .filter(Boolean) as { shelter: Shelter; coords: { lat: number; lon: number } }[];
  }, [shelters]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Default shelter markers */}
      {sheltersWithCoords.map(({ shelter, coords }) => {
        const isWaypoint = waypointIds.has(shelter.id);
        if (isWaypoint) return null; // Rendered separately as numbered marker
        return (
          <Marker
            key={shelter.id}
            position={[coords.lat, coords.lon]}
            opacity={0.7}
            eventHandlers={{
              click: () => onToggleShelter(shelter),
            }}
          >
            <Tooltip direction="top" offset={[0, -20]}>
              <div>
                <div className="text-sm font-medium">{shelter.title}</div>
                <div className="text-xs text-gray-500">
                  {shelter.capacity && `${shelter.capacity} pl.`}
                  {shelter.water && " · Vand"}
                  {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && " · Toilet"}
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Numbered waypoint markers */}
      {waypoints.map((shelter, i) => {
        const coords = getLocationCoords(shelter);
        if (!coords) return null;
        return (
          <Marker
            key={`wp-${shelter.id}`}
            position={[coords.lat, coords.lon]}
            icon={createWaypointIcon(i + 1)}
            eventHandlers={{
              click: () => onToggleShelter(shelter),
            }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              <span className="text-sm font-medium">{shelter.title}</span>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Route polyline */}
      {routePositions.length > 1 && (
        <Polyline positions={routePositions} pathOptions={ROUTE_LINE_OPTIONS} />
      )}

      {/* Trail overlay */}
      {showTrails && trailData && (
        <GeoJSON
          key="trails"
          data={{
            type: "FeatureCollection",
            features: trailData.map((t) => ({
              type: "Feature" as const,
              properties: { name: t.name, description: t.description },
              geometry: t.geometry,
            })),
          }}
          style={() => TRAIL_STYLE}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) {
              layer.bindTooltip(
                `<div class="font-medium text-sm">${escapeHtml(feature.properties.name)}</div>${
                  feature.properties.description
                    ? `<div class="text-xs text-primary/60 mt-0.5">${escapeHtml(feature.properties.description)}</div>`
                    : ""
                }`,
                { className: "trail-tooltip", sticky: true }
              );
            }
            layer.on("mouseover", function () {
              (layer as L.Path).setStyle({ opacity: 0.85, weight: 3.5 });
            });
            layer.on("mouseout", function () {
              (layer as L.Path).setStyle(TRAIL_STYLE);
            });
          }}
        />
      )}
    </>
  );
}

export default function RoutePlannerMap(props: Props) {
  const { waypoints, showTrails, onToggleTrails } = props;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        scrollWheelZoom
      >
        <MapContent {...props} />
      </MapContainer>

      {/* Map hint overlay */}
      {waypoints.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full shadow-sm px-4 py-2 text-sm text-primary/60 border border-primary/5 pointer-events-none">
          Klik på et shelter for at starte din rute
        </div>
      )}

      {/* Trail toggle button */}
      <button
        onClick={onToggleTrails}
        className={`absolute bottom-4 left-4 z-[1000] rounded-xl shadow-md border px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
          showTrails
            ? "bg-primary text-white border-primary"
            : "bg-white text-primary/70 border-primary/10 hover:border-primary/20 hover:text-primary"
        }`}
      >
        <Route size={16} />
        Vis vandreruter
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep -i "RoutePlannerMap" | head -5`
Expected: No errors mentioning this file

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RoutePlannerMap.tsx && git commit -m "feat(ruteplanner): add Leaflet map component with markers, route line, trail overlay"
```

---

## Task 7: RoutePlannerClient Component

**Files:**
- Create: `components/RoutePlannerClient.tsx`

State management, URL sync, coordinates map + sidebar. Dynamic imports RoutePlannerMap (Leaflet).

- [ ] **Step 1: Create the client component**

```typescript
// components/RoutePlannerClient.tsx
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Shelter } from "@/types/shelter";
import { RoutePlannerSidebar } from "./RoutePlannerSidebar";
import { getLocationCoords } from "@/lib/shelter-detail";
import { downloadGpx } from "@/lib/gpx-export";
import type { GpxWaypoint } from "@/lib/gpx-export";

const RoutePlannerMap = dynamic(() => import("./RoutePlannerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
      <span className="text-primary/30 text-sm">Indlæser kort...</span>
    </div>
  ),
});

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Geometry;
}

const MAX_WAYPOINTS = 20;

interface Props {
  shelters: Shelter[];
}

export function RoutePlannerClient({ shelters }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Build slug→shelter lookup
  const shelterBySlug = useMemo(() => {
    const map = new Map<string, Shelter>();
    for (const s of shelters) map.set(s.slug, s);
    return map;
  }, [shelters]);

  // Initialize waypoints from URL
  const initialWaypoints = useMemo(() => {
    const w = searchParams.get("w");
    if (!w) return [];
    return w
      .split(",")
      .map((slug) => shelterBySlug.get(slug))
      .filter(Boolean) as Shelter[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const [waypoints, setWaypoints] = useState<Shelter[]>(initialWaypoints);
  const [showTrails, setShowTrails] = useState(
    searchParams.get("trails") === "on"
  );
  const [trailData, setTrailData] = useState<Trail[] | null>(null);
  const [trailError, setTrailError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Update URL when waypoints change
  useEffect(() => {
    const params = new URLSearchParams();
    if (waypoints.length > 0) {
      params.set("w", waypoints.map((w) => w.slug).join(","));
    }
    if (showTrails) params.set("trails", "on");
    const qs = params.toString();
    const url = `/ruteplanner${qs ? `?${qs}` : ""}`;
    router.replace(url, { scroll: false });
  }, [waypoints, showTrails, router]);

  // Show toast with auto-dismiss
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Toggle shelter in/out of route
  const handleToggleShelter = useCallback(
    (shelter: Shelter) => {
      setWaypoints((prev) => {
        const idx = prev.findIndex((w) => w.id === shelter.id);
        if (idx >= 0) {
          return prev.filter((_, i) => i !== idx);
        }
        if (prev.length >= MAX_WAYPOINTS) {
          showToast(`Maks ${MAX_WAYPOINTS} shelters per rute`);
          return prev;
        }
        return [...prev, shelter];
      });
    },
    [showToast]
  );

  const handleRemove = useCallback((index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setWaypoints((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWaypoints((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
  }, []);

  const handleDownloadGpx = useCallback(() => {
    const gpxWaypoints: GpxWaypoint[] = waypoints
      .map((w) => {
        const coords = getLocationCoords(w);
        if (!coords) return null;
        return { name: w.title, lat: coords.lat, lon: coords.lon };
      })
      .filter(Boolean) as GpxWaypoint[];
    downloadGpx(gpxWaypoints);
  }, [waypoints]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {
      showToast("Kunne ikke kopiere link");
    });
  }, [showToast]);

  // Toggle trail overlay — lazy-load trail data on first toggle
  const handleToggleTrails = useCallback(async () => {
    const nextShow = !showTrails;
    setShowTrails(nextShow);

    if (nextShow && !trailData && !trailError) {
      try {
        const resp = await fetch("/data/trails.json");
        if (!resp.ok) throw new Error("Failed to fetch trails");
        const data: Trail[] = await resp.json();
        setTrailData(data);
      } catch {
        setTrailError(true);
        showToast("Kunne ikke indlæse vandreruter");
        setShowTrails(false);
      }
    }
  }, [showTrails, trailData, trailError, showToast]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      {/* Map */}
      <div className="flex-1 h-[60vh] md:h-full">
        <RoutePlannerMap
          shelters={shelters}
          waypoints={waypoints}
          onToggleShelter={handleToggleShelter}
          showTrails={showTrails}
          onToggleTrails={handleToggleTrails}
          trailData={trailData}
        />
      </div>

      {/* Sidebar (desktop) / Bottom section (mobile) */}
      <div className="w-full md:w-[340px] md:border-l border-primary/10 h-[40vh] md:h-full">
        <RoutePlannerSidebar
          waypoints={waypoints}
          onRemove={handleRemove}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClear={handleClear}
          onDownloadGpx={handleDownloadGpx}
          onShare={handleShare}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-fade-in-up">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep -i "RoutePlannerClient" | head -5`
Expected: No errors mentioning this file

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RoutePlannerClient.tsx && git commit -m "feat(ruteplanner): add client wrapper with state management and URL sync"
```

---

## Task 8: Server Page + Metadata

**Files:**
- Create: `app/(site)/ruteplanner/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/(site)/ruteplanner/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { createPublicClient } from "@/utils/supabase/server-public";
import { RoutePlannerClient } from "@/components/RoutePlannerClient";

export const metadata: Metadata = {
  title: "Ruteplanner - Planlæg din shelter-vandring",
  description:
    "Planlæg din vandrerute mellem shelters i Danmark. Se vandreruter, beregn afstande og download GPX.",
};

export default async function RutePlannerPage() {
  const supabase = createPublicClient();

  // Fetch all active shelters with minimal projection
  const allShelters = [];
  let from = 0;
  const BATCH = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, slug, title, location, capacity, water, toilet")
      .is("duplicate_of_shelter_id", null)
      .not("location", "is", null)
      .range(from, from + BATCH - 1);

    if (error || !data || data.length === 0) break;
    allShelters.push(...data);
    if (data.length < BATCH) break;
    from += BATCH;
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser ruteplanner...</span>
        </div>
      }
    >
      <RoutePlannerClient shelters={allShelters} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the page loads in dev**

Run: `cd /Users/CKA/shelterdk/web && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ruteplanner`
Expected: 200 (start dev server first if not running: `npm run dev`)

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add app/\(site\)/ruteplanner/page.tsx && git commit -m "feat(ruteplanner): add server page with shelter data loading"
```

---

## Task 9: Nav Link + Sitemap

**Files:**
- Modify: `components/Navbar.tsx:8-18` (navLinks array)
- Modify: `app/sitemap.ts:17-30` (STATIC_PAGES array)

- [ ] **Step 1: Add Ruteplanner to navLinks**

In `components/Navbar.tsx`, add to the `navLinks` array after `{ label: "Områder", href: "/omraade" }`:

```typescript
  { label: "Ruteplanner", href: "/ruteplanner" },
```

- [ ] **Step 2: Add to sitemap**

In `app/sitemap.ts`, add to the `STATIC_PAGES` array:

```typescript
  { path: "/ruteplanner", changeFrequency: "monthly", priority: 0.5 },
```

- [ ] **Step 3: Verify nav link renders**

Run: `cd /Users/CKA/shelterdk/web && curl -s http://localhost:3000/ | grep -o "Ruteplanner" | head -1`
Expected: "Ruteplanner"

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/Navbar.tsx app/sitemap.ts && git commit -m "feat(ruteplanner): add nav link and sitemap entry"
```

---

## Task 10: GeoFA Trail Import Script

**Files:**
- Create: `scripts/import-geofa-trails.ts`

- [ ] **Step 1: Create the import script**

```typescript
// scripts/import-geofa-trails.ts
/**
 * Fetch all hiking trails from GeoFA and write to public/data/trails.json.
 *
 * Usage:
 *   cd web && npx tsx scripts/import-geofa-trails.ts
 */

import * as fs from "fs";
import * as path from "path";

const GEOFA_URL =
  "https://geofa.geodanmark.dk/api/v2/sql/fkg?format=geojson&srs=4326&q=select+objekt_id,+navn,+beskrivels,+geometri+from+fkg.t_5802_fac_li+WHERE+rute_ty_k=5+AND+off_kode=1";

const OUTPUT_PATH = path.resolve(__dirname, "../public/data/trails.json");

interface GeoFAFeature {
  type: "Feature";
  properties: {
    objekt_id: string;
    navn: string | null;
    beskrivels: string | null;
  };
  geometry: GeoJSON.Geometry;
}

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Geometry;
}

function simplifyCoordinates(geom: any): any {
  // Reduce coordinate precision to 5 decimal places (~1m accuracy)
  if (Array.isArray(geom)) {
    if (typeof geom[0] === "number") {
      return geom.map((n: number) =>
        typeof n === "number" ? Math.round(n * 100000) / 100000 : n
      );
    }
    return geom.map(simplifyCoordinates);
  }
  if (geom && typeof geom === "object" && geom.coordinates) {
    return { ...geom, coordinates: simplifyCoordinates(geom.coordinates) };
  }
  return geom;
}

async function main() {
  console.log("Fetching hiking trails from GeoFA...");
  const resp = await fetch(GEOFA_URL);
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }

  const geojson = await resp.json();
  const features: GeoFAFeature[] = geojson.features || [];
  console.log(`Received ${features.length} features.`);

  const trails: Trail[] = features
    .filter((f) => {
      const name = f.properties?.navn?.trim();
      return name && name.length > 0;
    })
    .map((f) => ({
      id: f.properties.objekt_id,
      name: f.properties.navn!.trim(),
      description: f.properties.beskrivels?.trim() || null,
      geometry: simplifyCoordinates(f.geometry),
    }));

  console.log(`Filtered to ${trails.length} trails with names.`);

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(trails);
  fs.writeFileSync(OUTPUT_PATH, json, "utf-8");

  const sizeMB = (Buffer.byteLength(json, "utf-8") / (1024 * 1024)).toFixed(1);
  console.log(`\nWritten to ${OUTPUT_PATH}`);
  console.log(`File size: ${sizeMB} MB`);
  console.log(`Trails: ${trails.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

Run: `cd /Users/CKA/shelterdk/web && npx tsx scripts/import-geofa-trails.ts`
Expected: Output showing number of trails fetched and file size. Note the file size — if >5 MB, we may need further optimization.

- [ ] **Step 3: Add trails.json to .gitignore (generated file)**

Add to `.gitignore`:
```
public/data/trails.json
```

- [ ] **Step 4: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add scripts/import-geofa-trails.ts .gitignore && git commit -m "feat(ruteplanner): add GeoFA trail import script"
```

---

## Task 11: Integration Test — Full Page Load

**Files:** No new files — manual verification

- [ ] **Step 1: Start dev server and verify page loads**

Run: `cd /Users/CKA/shelterdk/web && npm run dev` (if not already running)

Open `http://localhost:3000/ruteplanner` in browser and verify:
1. Map renders with shelter markers
2. Empty state text shows in sidebar
3. Clicking a marker adds it as a waypoint (numbered marker appears, sidebar updates)
4. Clicking a second marker draws a dashed line between them
5. Distance and walking time display in sidebar
6. Up/down reorder buttons work
7. Remove (✕) button removes waypoint
8. "Download GPX" downloads a file
9. "Del rute" copies URL to clipboard
10. "Ryd" clears all waypoints
11. "Vis vandreruter" loads and displays trail overlay (requires trails.json to exist)
12. URL updates with `?w=slug1,slug2` as waypoints change
13. Refreshing page with `?w=` params restores the route
14. Nav link "Ruteplanner" appears in navbar

- [ ] **Step 2: Verify production build**

Run: `cd /Users/CKA/shelterdk/web && npm run build 2>&1 | tail -20`
Expected: Build succeeds, `/ruteplanner` page listed in output

- [ ] **Step 3: Commit any fixes needed**

---

## Task 12: Mobile Bottom Sheet Refinement

**Files:**
- Modify: `components/RoutePlannerClient.tsx`

After verifying the basic mobile layout works, refine the bottom sheet behavior.

- [ ] **Step 1: Add collapsible bottom sheet state**

In `RoutePlannerClient.tsx`, add a `sheetExpanded` state and toggle behavior:

```typescript
const [sheetExpanded, setSheetExpanded] = useState(false);
```

Update the mobile sidebar container to support collapsed/expanded states:

```tsx
{/* Sidebar (desktop) / Bottom sheet (mobile) */}
<div
  className={`w-full md:w-[340px] md:border-l border-primary/10 md:h-full transition-all duration-300 ${
    sheetExpanded ? "h-[50vh]" : "h-auto max-h-[30vh]"
  } md:max-h-full overflow-hidden`}
>
  {/* Mobile drag handle */}
  <button
    onClick={() => setSheetExpanded(!sheetExpanded)}
    className="md:hidden w-full flex justify-center py-2 bg-white border-t border-primary/10"
    aria-label={sheetExpanded ? "Skjul panel" : "Vis panel"}
  >
    <div className="w-10 h-1 rounded-full bg-primary/20" />
  </button>

  {/* Mobile collapsed summary */}
  {!sheetExpanded && waypoints.length > 0 && (
    <button
      onClick={() => setSheetExpanded(true)}
      className="md:hidden w-full px-4 py-2 bg-white text-sm text-primary/60 border-t border-primary/10"
    >
      {waypoints.length} shelter{waypoints.length !== 1 ? "s" : ""} ·{" "}
      {formatDistance(totalKm)}
    </button>
  )}

  <RoutePlannerSidebar ... />
</div>
```

Note: `totalKm` needs to be computed in the client component as well, or passed from the sidebar. The simplest approach is to compute it here using the same haversine logic. See spec for exact implementation.

- [ ] **Step 2: Test on mobile viewport (Chrome DevTools responsive mode)**

Verify:
1. Bottom sheet shows collapsed summary
2. Tapping handle or summary expands
3. Full waypoint list scrollable when expanded
4. Map still interactive above the sheet

- [ ] **Step 3: Commit**

```bash
cd /Users/CKA/shelterdk/web && git add components/RoutePlannerClient.tsx && git commit -m "feat(ruteplanner): add mobile bottom sheet collapse/expand"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Haversine utility | `lib/haversine.ts` |
| 2 | GPX export utility | `lib/gpx-export.ts` |
| 3 | Add capacity to Shelter type | `types/shelter.ts` |
| 4 | CSS for markers + tooltips | `app/globals.css` |
| 5 | Sidebar component | `components/RoutePlannerSidebar.tsx` |
| 6 | Map component | `components/RoutePlannerMap.tsx` |
| 7 | Client wrapper | `components/RoutePlannerClient.tsx` |
| 8 | Server page | `app/(site)/ruteplanner/page.tsx` |
| 9 | Nav + sitemap | `components/Navbar.tsx`, `app/sitemap.ts` |
| 10 | Trail import script | `scripts/import-geofa-trails.ts` |
| 11 | Integration test | Manual verification |
| 12 | Mobile refinement | `components/RoutePlannerClient.tsx` |

Tasks 1-4 are independent and can be parallelized. Tasks 5-7 depend on 1-4. Task 8 depends on 7. Task 9 is independent. Task 10 is independent. Tasks 11-12 depend on everything.
