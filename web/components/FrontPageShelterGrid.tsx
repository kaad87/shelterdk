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
  const priorityCount = 6; // Above-the-fold kort får priority for LCP

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
      {toShow.map((shelter, index) => (
        <ShelterCard
          key={shelter.id}
          shelter={shelter}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
