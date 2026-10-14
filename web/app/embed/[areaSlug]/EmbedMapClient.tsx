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
      {/* stays={[]} er bevidst, ikke en udeladelse: embed-kortet ligger paa
          partneres egne sites, og at laegge vores annoncer dér er en aftale de
          skal sige ja til. Udelades proppen, henter kortet dem selv. */}
      <ShelterMap
        stays={[]}
        shelters={shelters}
        className="w-full h-full min-h-screen"
        embedMode
      />
    </div>
  );
}
