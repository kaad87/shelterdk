"use client";

import { useCallback, useState } from "react";
import { Hand } from "lucide-react";
import type { MapShelter } from "@/lib/map-shelter";
import type { StayPin } from "@/lib/nature-stays";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";

interface MapComponentProps {
  /** Første visning – bruges indtil brugeren pan/zoomer; derefter hentes data via bbox-RPC. */
  shelters: MapShelter[];
  /** Premium guld-markører for betalte naturophold (få, nationalt — statiske). */
  stays?: StayPin[];
  className?: string;
}

/**
 * Kort på forsiden: viser initiale shelters og henter kun shelters i viewport
 * ved moveend/zoom via PostGIS RPC (get_shelters_in_bbox) for hurtigere load.
 */
export function MapComponent({ shelters: initialShelters, stays, className }: MapComponentProps) {
  const [shelters, setShelters] = useState<MapShelter[]>(initialShelters);
  // Mobil: kortet fylder ~60 % af skærmen midt på forsiden. Uden dette fanger
  // Leaflet lodret swipe som panorering, så man ikke kan scrolle forbi. Et
  // overlay lader siden scrolle og aktiverer først kortet ved tap (desktop har
  // mus uden scroll-fælde → intet overlay).
  const [active, setActive] = useState(false);

  const handleBoundsChange = useCallback(async (bounds: MapBounds) => {
    const params = new URLSearchParams({
      nord: String(bounds.north),
      syd: String(bounds.south),
      ost: String(bounds.east),
      vest: String(bounds.west),
    });
    try {
      const res = await fetch(`/api/map/shelters?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.shelters ?? []) as MapShelter[];
      setShelters(list);
    } catch {
      // Behold nuværende markers ved fejl
    }
  }, []);

  return (
    <div className={`relative ${className ?? ""}`}>
      <ShelterMap
        shelters={shelters}
        stays={stays}
        className="h-full w-full"
        onBoundsChange={handleBoundsChange}
        fitWholeDenmarkOnLoad
        loadViewportOnMount
      />
      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label="Aktivér kortet"
          className="absolute inset-0 z-[1000] flex items-end justify-center bg-transparent pb-5 md:hidden"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/85 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
            <Hand className="h-4 w-4" aria-hidden />
            Tryk for at bruge kortet
          </span>
        </button>
      )}
    </div>
  );
}
