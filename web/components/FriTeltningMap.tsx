"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, Path } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection, Feature } from "geojson";

const DEFAULT_CENTER: [number, number] = [56.1, 10.2];
const DEFAULT_ZOOM = 7;

const AREA_STYLE = { color: "#2F6B3A", weight: 1.5, fillColor: "#3F8F4E", fillOpacity: 0.35 };
const AREA_HOVER = { weight: 2.5, fillOpacity: 0.55 };

interface Props {
  /** Hentes klient-side fra /data/fri-teltning.json (213 KB) — holdes ude af HTML'en. */
  src: string;
}

/** Kort over fri teltning-områder: 313 polygoner fra GeoFA, klik → detaljer i listen. */
export default function FriTeltningMap({ src }: Props) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setData(d as FeatureCollection))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);

  const onEach = (feature: Feature, layer: Layer) => {
    const p = feature.properties as { slug: string; name: string; kommune: string | null; ha: number | null };
    const ha = p.ha != null ? `${Math.round(p.ha).toLocaleString("da-DK")} ha` : "";
    layer.bindTooltip(`<strong>${p.name}</strong>${p.kommune ? `<br>${p.kommune}` : ""}${ha ? ` · ${ha}` : ""}`, { sticky: true });
    layer.on({
      mouseover: (e) => (e.target as Path).setStyle(AREA_HOVER),
      mouseout: (e) => (e.target as Path).setStyle(AREA_STYLE),
      click: () => {
        const el = document.getElementById(`omraade-${p.slug}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el instanceof HTMLDetailsElement) el.open = true;
        }
      },
    });
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-full z-0" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data && <GeoJSON data={data} style={() => AREA_STYLE} onEachFeature={onEach} />}
      </MapContainer>
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-primary/60 bg-background/40 pointer-events-none">
          Henter områder…
        </div>
      )}
    </div>
  );
}
