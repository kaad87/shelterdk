"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords } from "@/lib/shelter-detail";

// Leaflet CSS – kun på client
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [56.2639, 9.5018]; // Danmark
const DEFAULT_ZOOM = 7;

/** Regionsspecifik startposition for at undgå at vise hele Danmark når filter er sat. */
const REGION_CENTER_ZOOM: Record<string, { center: [number, number]; zoom: number }> = {
  Jylland: { center: [56.2, 9.2], zoom: 8 },
  Fyn: { center: [55.3, 10.4], zoom: 9 },
  Sjælland: { center: [55.7, 12.0], zoom: 8 },
};

export interface ShelterWithCoords extends Shelter {
  _coords: { lat: number; lon: number };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

function getSheltersWithCoords(shelters: Shelter[]): ShelterWithCoords[] {
  return shelters
    .map((s) => {
      const coords = getLocationCoords(s);
      if (!coords) return null;
      return { ...s, _coords: coords } as ShelterWithCoords;
    })
    .filter((s): s is ShelterWithCoords => s != null);
}

// Dynamisk import af kortet så Leaflet kun kører i browser
const MapInner = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Popup, useMap } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");
    const { useEffect, useRef } = await import("react");
    const Link = (await import("next/link")).default;
    const { isValidImageUrl } = await import("@/lib/shelter-detail");

    // Fix default marker-ikon (Next/Leaflet)
    const icon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    function FitBounds({ items }: { items: { lat: number; lon: number }[] }) {
      const map = useMap();
      const hasFittedRef = useRef(false);
      useEffect(() => {
        if (items.length === 0) return;
        if (hasFittedRef.current) return;
        hasFittedRef.current = true;
        if (items.length === 1) {
          map.setView([items[0].lat, items[0].lon], 12);
        } else {
          const bounds = L.latLngBounds(
            items.map((p) => [p.lat, p.lon] as [number, number])
          );
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
        }
      }, [map, items]);
      return null;
    }

    function BoundsReporter({
      onBoundsChange,
    }: {
      onBoundsChange?: (bounds: MapBounds) => void;
    }) {
      const map = useMap();
      const initialFitDoneRef = { current: false };
      useEffect(() => {
        if (!onBoundsChange) return;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const handler = () => {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => {
            timeout = null;
            if (!initialFitDoneRef.current) {
              initialFitDoneRef.current = true;
              return;
            }
            const b = map.getBounds();
            if (b.isValid()) {
              onBoundsChange({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
              });
            }
          }, 400);
        };
        map.on("moveend", handler);
        map.on("zoomend", handler);
        return () => {
          if (timeout) clearTimeout(timeout);
          map.off("moveend", handler);
          map.off("zoomend", handler);
        };
      }, [map, onBoundsChange]);
      return null;
    }

    return function Inner({
      sheltersWithCoords,
      onBoundsChange,
      initialCenter,
      initialZoom,
    }: {
      sheltersWithCoords: ShelterWithCoords[];
      onBoundsChange?: (bounds: MapBounds) => void;
      initialCenter?: [number, number];
      initialZoom?: number;
    }) {
      const points = useMemo(
        () => sheltersWithCoords.map((s) => s._coords),
        [sheltersWithCoords]
      );
      const center = initialCenter ?? DEFAULT_CENTER;
      const zoom = initialZoom ?? DEFAULT_ZOOM;
      return (
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full rounded-xl z-0 min-h-[400px]"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds items={points} />
          <BoundsReporter onBoundsChange={onBoundsChange} />
          {sheltersWithCoords.map((shelter) => (
            <Marker
              key={shelter.id}
              position={[shelter._coords.lat, shelter._coords.lon]}
              icon={icon}
            >
              <Popup closeButton={false}>
                <Link
                  href={`/shelter/${shelter.slug}`}
                  className="block p-1 min-w-[180px] text-primary no-underline hover:opacity-90"
                >
                  {isValidImageUrl(shelter.image_url) && (
                    <div className="w-full aspect-video rounded overflow-hidden bg-primary/10 mb-2">
                      <img
                        src={(shelter.image_url || "").trim()}
                        alt=""
                        className="w-full h-full object-cover"
                        width={240}
                        height={135}
                      />
                    </div>
                  )}
                  <span className="font-semibold text-primary block">
                    {shelter.title}
                  </span>
                  {shelter.region && (
                    <p className="text-sm text-primary/70 mt-0.5">
                      {shelter.region}
                    </p>
                  )}
                  <span className="text-sm text-accent font-medium mt-2 inline-block">
                    Se shelter →
                  </span>
                </Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

interface ShelterMapProps {
  shelters: Shelter[];
  className?: string;
  /** Kaldes når brugeren pan/zoomer – bruges til at hente shelters i det synlige område. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Ved region-filter (Jylland, Fyn, Sjælland) zoomes kortet ind på regionen i stedet for hele Danmark. */
  initialRegion?: string | null;
}

export function ShelterMap({
  shelters,
  className = "",
  onBoundsChange,
  initialRegion,
}: ShelterMapProps) {
  const regionView = initialRegion ? REGION_CENTER_ZOOM[initialRegion] : undefined;
  const initialCenter = regionView?.center;
  const initialZoom = regionView?.zoom;
  const withCoords = getSheltersWithCoords(shelters);

  if (withCoords.length === 0) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-xl bg-primary/5 text-primary/70 min-h-[400px] " +
          className
        }
      >
        <p>Ingen shelters med placering at vise på kortet.</p>
      </div>
    );
  }

  return (
    <div className={"rounded-xl overflow-hidden border border-primary/10 " + className}>
      <MapInner
        sheltersWithCoords={withCoords}
        onBoundsChange={onBoundsChange}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
      />
    </div>
  );
}
