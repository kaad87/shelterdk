"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// Trin 2 — Placering på kort. Leaflet-kortvælger (SSR slået fra), migreret
// uændret fra ShelterSubmissionForm (LayersControl-baselag mv.).

const SubmissionMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, LayersControl, Marker, useMapEvents } =
      await import("react-leaflet");
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({
          click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }

      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [56.0, 10.0];

      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 300, width: "100%" }}
          className="rounded-xl z-0 [&_.leaflet-control-attribution]:text-[10px]"
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Kort">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellit">
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

interface StepMapProps {
  lat: number | null;
  lng: number | null;
  setLat: (v: number | null) => void;
  setLng: (v: number | null) => void;
}

export function StepMap({ lat, lng, setLat, setLng }: StepMapProps) {
  return (
    <div>
      <p className="text-sm text-primary/60 mb-3">Klik på kortet for at sætte en pin.</p>
      <div className="rounded-xl overflow-hidden border border-primary/10 mb-3">
        <SubmissionMapPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
      </div>
      {lat != null && lng != null ? (
        <p className="text-xs text-primary/50">
          Koordinater: {lat.toFixed(5)}, {lng.toFixed(5)}
          <button
            type="button"
            onClick={() => {
              setLat(null);
              setLng(null);
            }}
            className="ml-2 text-red-400 hover:text-red-600 underline"
          >
            Fjern pin
          </button>
        </p>
      ) : (
        <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-700">
          Ingen pin sat — admin vil sætte koordinater ved gennemgang.
        </p>
      )}
    </div>
  );
}
