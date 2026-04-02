"use client";

import dynamic from "next/dynamic";
import { MapPin, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const MAP_HEIGHT = 300;

const LocationMapInner = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMap } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");
    const { useEffect } = await import("react");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    function SetView({ lat, lon }: { lat: number; lon: number }) {
      const map = useMap();
      useEffect(() => {
        map.setView([lat, lon], 14);
      }, [map, lat, lon]);
      return null;
    }

    return function Inner({
      lat,
      lon,
    }: {
      lat: number;
      lon: number;
    }) {
      return (
        <MapContainer
          center={[lat, lon]}
          zoom={14}
          className="h-full w-full rounded-xl z-0 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:opacity-70"
          style={{ height: MAP_HEIGHT }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <SetView lat={lat} lon={lon} />
          <Marker position={[lat, lon]} icon={icon} />
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

interface ShelterLocationMapProps {
  lat: number;
  lon: number;
  openStreetMapUrl: string;
  googleMapsUrl: string | null;
}

export function ShelterLocationMap({
  lat,
  lon,
  openStreetMapUrl,
  googleMapsUrl,
}: ShelterLocationMapProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible) return;
    const element = containerRef.current;
    if (!element) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="rounded-2xl overflow-hidden border border-primary/10 bg-white shadow-sm ring-1 ring-primary/5">
        {isVisible ? (
          <LocationMapInner lat={lat} lon={lon} />
        ) : (
          <div
            className="w-full rounded-xl bg-primary/5 animate-pulse"
            style={{ height: MAP_HEIGHT }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={openStreetMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
        >
          <MapPin size={16} className="text-accent shrink-0" />
          Åbn i OpenStreetMap
        </a>
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            <ExternalLink size={16} className="text-accent shrink-0" />
            Åbn i Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
