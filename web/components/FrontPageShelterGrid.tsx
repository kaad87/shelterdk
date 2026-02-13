"use client";

import { ShelterCard } from "@/components/ShelterCard";
import type { Shelter } from "@/types/shelter";

interface FrontPageShelterGridProps {
  shelters: Shelter[];
  maxVisible?: number;
}

/** Viser shelter-kort på forsiden. Billedfejl vises som placeholder – ingen udskiftning så listen ikke "hopper". */
export function FrontPageShelterGrid({
  shelters,
  maxVisible = 12,
}: FrontPageShelterGridProps) {
  const toShow = shelters.slice(0, maxVisible);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {toShow.map((shelter) => (
        <ShelterCard key={shelter.id} shelter={shelter} />
      ))}
    </div>
  );
}
