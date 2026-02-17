"use client";

import { useEffect, useState } from "react";
import { ShelterMap } from "@/components/ShelterMap";
import type { Shelter } from "@/types/shelter";

interface EmbedMapClientProps {
  shelters: Shelter[];
  areaName: string;
}

export function EmbedMapClient({ shelters, areaName }: EmbedMapClientProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Kun rendér kortet på client for at undgå hydration mismatch med Leaflet
  if (!mounted) {
    return (
      <div
        className="w-full h-full min-h-screen bg-primary/5"
        aria-label={`Shelter-kort: ${areaName}`}
      />
    );
  }

  return (
    <div className="w-full h-full min-h-screen" aria-label={`Shelter-kort: ${areaName}`}>
      <ShelterMap
        shelters={shelters}
        className="w-full h-full min-h-screen"
        embedMode
      />
    </div>
  );
}
