"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

import type { AddressHit } from "@/lib/address-search";

/** Leaflet-kort med klik/træk-markør. Dynamisk (kun browser). */
const MapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMapEvents } = await import("react-leaflet");
    const L = await import("leaflet");
    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
      useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
      return null;
    }
    return function Map({ coords, onPick }: { coords: { lat: number; lng: number } | null; onPick: (lat: number, lng: number) => void }) {
      const center: [number, number] = coords ? [coords.lat, coords.lng] : [56.0, 11.0];
      return (
        <MapContainer center={center} zoom={coords ? 13 : 6} scrollWheelZoom className="h-64 w-full rounded-lg" style={{ zIndex: 0 }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onPick={onPick} />
          {coords && (
            <Marker
              position={[coords.lat, coords.lng]}
              icon={icon}
              draggable
              eventHandlers={{ dragend: (e) => { const p = (e.target as { getLatLng: () => { lat: number; lng: number } }).getLatLng(); onPick(p.lat, p.lng); } }}
            />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

interface Props {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string, meta?: { place?: string }) => void;
}

/** Adresse-autocomplete + kort-picker → udfylder lat/lng (+ by). */
export function StayLocationPicker({ lat, lng, onChange }: Props) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);

  const coords = lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;

  useEffect(() => {
    if (q.trim().length < 3) { setSuggestions([]); return; }
    // 600 ms, ikke 250: Nominatim tillader ét kald i sekundet, og feltet
    // bruges kun i admin. DAWA, der tidligere svarede her, lukkede 1/10-2026.
    const t = setTimeout(async () => {
      try {
        // Samme oprindelse: CSP'ens connect-src er lukket, og Nominatim kræver
        // en User-Agent som browseren ikke må sætte. Ruten gør begge dele.
        const r = await fetch(`/api/address-search?q=${encodeURIComponent(q.trim())}`);
        if (r.ok) {
          setSuggestions((await r.json()).results ?? []);
          setOpen(true);
        }
      } catch { /* ignorér netværksfejl */ }
    }, 600);
    return () => clearTimeout(t);
  }, [q]);

  function selectAddress(item: AddressHit) {
    setQ(item.tekst);
    setSuggestions([]);
    setOpen(false);
    onChange(String(item.lat), String(item.lon), { place: item.place ?? undefined });
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-sm font-medium text-primary/80">Adresse (udfylder placering automatisk)</label>
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={q}
          placeholder="Søg adresse, fx Skovvej 1, 8000 Aarhus…"
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-primary/15 bg-white shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent/10" onClick={() => selectAddress(s)}>
                  {s.tekst}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapPicker coords={coords} onPick={(la, ln) => onChange(String(la), String(ln))} />
      <p className="text-xs text-primary/50">Klik eller træk markøren på kortet for at finjustere.</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Lat<input className="w-full rounded border px-2 py-1" value={lat} onChange={(e) => onChange(e.target.value, lng)} /></label>
        <label className="text-sm">Lng<input className="w-full rounded border px-2 py-1" value={lng} onChange={(e) => onChange(lat, e.target.value)} /></label>
      </div>
    </div>
  );
}
