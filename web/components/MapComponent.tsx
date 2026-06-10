"use client";

import { useCallback, useState } from "react";
import type { MapShelter } from "@/lib/map-shelter";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";

interface MapComponentProps {
  /** Første visning – bruges indtil brugeren pan/zoomer; derefter hentes data via bbox-RPC. */
  shelters: MapShelter[];
  className?: string;
}

/**
 * Kort på forsiden: viser initiale shelters og henter kun shelters i viewport
 * ved moveend/zoom via PostGIS RPC (get_shelters_in_bbox) for hurtigere load.
 */
export function MapComponent({ shelters: initialShelters, className }: MapComponentProps) {
  const [shelters, setShelters] = useState<MapShelter[]>(initialShelters);

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
    <ShelterMap
      shelters={shelters}
      className={className}
      onBoundsChange={handleBoundsChange}
      fitWholeDenmarkOnLoad
      loadViewportOnMount
    />
  );
}
