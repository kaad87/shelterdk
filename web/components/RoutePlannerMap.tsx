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
import type { RoutePlannerShelter } from "@/types/shelter";

// Use same icon pattern as existing ShelterMap.tsx
const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

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
  shelters: RoutePlannerShelter[];
  waypoints: RoutePlannerShelter[];
  onToggleShelter: (shelter: RoutePlannerShelter) => void;
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

  const routePositions = useMemo(() => {
    return waypoints
      .map((w) => getLocationCoords(w))
      .filter(Boolean)
      .map((c) => [c!.lat, c!.lon] as [number, number]);
  }, [waypoints]);

  const sheltersWithCoords = useMemo(() => {
    return shelters
      .map((s) => {
        const coords = getLocationCoords(s);
        if (!coords) return null;
        return { shelter: s, coords };
      })
      .filter(Boolean) as { shelter: RoutePlannerShelter; coords: { lat: number; lon: number } }[];
  }, [shelters]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {sheltersWithCoords.map(({ shelter, coords }) => {
        const isWaypoint = waypointIds.has(shelter.id);
        if (isWaypoint) return null;
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

      {routePositions.length > 1 && (
        <Polyline positions={routePositions} pathOptions={ROUTE_LINE_OPTIONS} />
      )}

      {showTrails && trailData && (
        <GeoJSON
          key="trails"
          data={{
            type: "FeatureCollection" as const,
            features: trailData.map((t) => ({
              type: "Feature" as const,
              properties: { name: t.name, description: t.description },
              geometry: t.geometry,
            })),
          } as GeoJSON.FeatureCollection}
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

      {waypoints.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full shadow-sm px-4 py-2 text-sm text-primary/60 border border-primary/5 pointer-events-none">
          Klik på et shelter for at starte din rute
        </div>
      )}

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
