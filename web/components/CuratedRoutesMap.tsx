// components/CuratedRoutesMap.tsx
"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Tooltip,
  Rectangle,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CuratedRouteIndex, CuratedRouteData } from "@/types/curated-route";
import type { ShelterWithDistance } from "@/lib/shelter-distance";

const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_CENTER: [number, number] = [56.2639, 9.5018];
const DEFAULT_ZOOM = 7;

const ROUTE_STYLE = {
  color: "#C5A059",
  weight: 4,
  opacity: 1,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

const OVERVIEW_ROUTE_STYLE = {
  color: "#E67E22",
  weight: 3,
  opacity: 0.7,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

const OVERVIEW_ROUTE_HOVER = {
  weight: 3.5,
  opacity: 1,
};

interface Props {
  /** All routes index for overview bbox rendering */
  routeIndex: CuratedRouteIndex[];
  /** Full route data when a route is selected (null = overview mode) */
  routeData: CuratedRouteData | null;
  /** Slug of selected route (used as GeoJSON key) */
  selectedSlug: string | null;
  /** Called when user clicks a route bbox on the overview map */
  onRouteClick?: (slug: string) => void;
  /** Full route data map for overview rendering (loaded lazily) */
  allRouteData: Record<string, CuratedRouteData> | null;
  /** Uploaded GPX route points (lat/lon array) */
  uploadedRoute?: { lat: number; lon: number }[];
  /** Shelters near the uploaded route */
  uploadedShelters?: ShelterWithDistance[];
}

/**
 * Annullér pending Leaflet-transitions ved unmount — se kommentar i
 * ShelterMap.tsx (samme race-condition i alle vores Leaflet-kort).
 */
function MapCleanup() {
  const map = useMap();
  useEffect(() => {
    return () => {
      try { map.stop(); } catch { /* already destroyed */ }
    };
  }, [map]);
  return null;
}

/** Zoom to selected route bounds. */
function FitBounds({ routeData }: { routeData: CuratedRouteData }) {
  const map = useMap();

  useEffect(() => {
    const bounds: [number, number][] = [];
    const extractCoords = (coords: number[][]) => {
      for (const [lon, lat] of coords) bounds.push([lat, lon]);
    };
    const geom = routeData.geometry;
    if (geom.type === "LineString") {
      extractCoords(geom.coordinates);
    } else if (geom.type === "MultiLineString") {
      for (const line of geom.coordinates) extractCoords(line);
    }
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    }
  }, [map, routeData]);

  return null;
}

/** Reset zoom to Denmark overview when deselecting. */
function ResetView({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (active) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
    }
  }, [map, active]);
  return null;
}

/** Overview mode: render all routes as GeoJSON lines (if data loaded) or bbox rectangles. */
function OverviewRoutes({
  routeIndex,
  allRouteData,
  onRouteClick,
}: {
  routeIndex: CuratedRouteIndex[];
  allRouteData: Record<string, CuratedRouteData> | null;
  onRouteClick?: (slug: string) => void;
}) {
  // If full data is loaded, render each route as a Polyline.
  // We use Polyline instead of GeoJSON because react-leaflet's GeoJSON
  // component is immutable after mount and doesn't respond to filter changes.
  if (allRouteData) {
    return (
      <>
        {routeIndex
          .filter((r) => allRouteData[r.slug])
          .map((r) => {
            const geom = allRouteData[r.slug].geometry;
            // Convert GeoJSON coordinates to Leaflet [lat, lng] positions
            const positions: [number, number][][] = [];
            if (geom.type === "LineString") {
              positions.push(geom.coordinates.map(([lon, lat]: number[]) => [lat, lon] as [number, number]));
            } else if (geom.type === "MultiLineString") {
              for (const line of geom.coordinates) {
                positions.push(line.map(([lon, lat]: number[]) => [lat, lon] as [number, number]));
              }
            }
            return positions.map((pos, i) => (
              <Polyline
                key={`route-${r.slug}-${i}`}
                positions={pos}
                pathOptions={OVERVIEW_ROUTE_STYLE}
                eventHandlers={{
                  mouseover: (e) => {
                    (e.target as L.Path).setStyle(OVERVIEW_ROUTE_HOVER);
                    e.target.bindTooltip(r.name, { sticky: true, className: "text-sm font-medium" }).openTooltip();
                  },
                  mouseout: (e) => {
                    (e.target as L.Path).setStyle(OVERVIEW_ROUTE_STYLE);
                    e.target.closeTooltip();
                  },
                  click: () => onRouteClick?.(r.slug),
                }}
              />
            ));
          })}
      </>
    );
  }

  // Fallback: render bbox rectangles before full data is loaded
  return (
    <>
      {routeIndex.map((r) => {
        const [minLon, minLat, maxLon, maxLat] = r.bbox;
        return (
          <Rectangle
            key={r.slug}
            bounds={[
              [minLat, minLon],
              [maxLat, maxLon],
            ]}
            pathOptions={{
              color: "#2C3E50",
              weight: 2,
              opacity: 0.6,
              fillColor: "#C5A059",
              fillOpacity: 0.15,
            }}
            eventHandlers={{
              click: () => onRouteClick?.(r.slug),
            }}
          />
        );
      })}
    </>
  );
}

/** Selected route: geometry line + shelter markers. */
function SelectedRoute({ routeData, slug }: { routeData: CuratedRouteData; slug: string }) {
  const geoJsonData: GeoJSON.FeatureCollection = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: routeData.geometry,
      },
    ],
  };

  return (
    <>
      <GeoJSON
        key={`selected-${slug}`}
        data={geoJsonData}
        style={() => ROUTE_STYLE}
      />

      {routeData.shelters.map((shelter) => (
        <Marker key={shelter.id} position={[shelter.lat, shelter.lon]}>
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
      ))}

      <FitBounds routeData={routeData} />
    </>
  );
}

const UPLOADED_ROUTE_STYLE = {
  color: "#3B82F6",
  weight: 4,
  opacity: 1,
};

/** Fit bounds to uploaded GPX route. */
function FitUploadedBounds({ points }: { points: { lat: number; lon: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/** Uploaded GPX route: polyline + shelter markers. */
function UploadedRoute({
  points,
  shelters,
}: {
  points: { lat: number; lon: number }[];
  shelters: ShelterWithDistance[];
}) {
  const positions: [number, number][] = points.map((p) => [p.lat, p.lon]);

  return (
    <>
      <Polyline positions={positions} pathOptions={UPLOADED_ROUTE_STYLE} />

      {shelters.map((shelter) => (
        <Marker key={shelter.id} position={[shelter.lat, shelter.lon]}>
          <Tooltip direction="top" offset={[0, -20]}>
            <div>
              <div className="text-sm font-medium">{shelter.title}</div>
              <div className="text-xs text-gray-500">
                {shelter.distanceKm} km fra ruten
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}

      <FitUploadedBounds points={points} />
    </>
  );
}

export default function CuratedRoutesMap({
  routeIndex,
  routeData,
  selectedSlug,
  onRouteClick,
  allRouteData,
  uploadedRoute,
  uploadedShelters,
}: Props) {
  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Overview mode: show all routes */}
        {!selectedSlug && (
          <OverviewRoutes
            routeIndex={routeIndex}
            allRouteData={allRouteData}
            onRouteClick={onRouteClick}
          />
        )}

        {/* Selected mode: show single route + shelters */}
        {selectedSlug && routeData && (
          <SelectedRoute routeData={routeData} slug={selectedSlug} />
        )}

        {/* Uploaded GPX route mode */}
        {uploadedRoute && uploadedRoute.length > 0 && (
          <UploadedRoute
            points={uploadedRoute}
            shelters={uploadedShelters ?? []}
          />
        )}

        {/* Reset view when deselecting (only when no uploaded route) */}
        <ResetView active={!selectedSlug && !uploadedRoute} />

        {/* Stop pending Leaflet-transitions ved unmount */}
        <MapCleanup />
      </MapContainer>

      {!selectedSlug && !allRouteData && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full shadow-sm px-4 py-2 text-sm text-primary/60 border border-primary/5 pointer-events-none">
          Vælg en rute nedenfor for at se den på kortet
        </div>
      )}
    </div>
  );
}
