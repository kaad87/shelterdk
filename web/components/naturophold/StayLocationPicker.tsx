"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

interface DawaItem {
  tekst: string;
  adgangsadresse?: { x?: number; y?: number; postnrnavn?: string };
}

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

/** Adresse-autocomplete (DAWA) + kort-picker → udfylder lat/lng (+ by). */
export function StayLocationPicker({ lat, lng, onChange }: Props) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<DawaItem[]>([]);
  const [open, setOpen] = useState(false);

  const coords = lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;

  useEffect(() => {
    if (q.trim().length < 3) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.dataforsyningen.dk/adgangsadresser/autocomplete?q=${encodeURIComponent(q)}&per_side=6&srid=4326`);
        if (r.ok) { setSuggestions(await r.json()); setOpen(true); }
      } catch { /* ignorér netværksfejl */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function selectAddress(item: DawaItem) {
    const a = item.adgangsadresse;
    setQ(item.tekst);
    setSuggestions([]);
    setOpen(false);
    if (a?.x != null && a?.y != null) {
      onChange(String(a.y), String(a.x), { place: a.postnrnavn });
    }
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
