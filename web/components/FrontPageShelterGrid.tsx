"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ShelterCard } from "@/components/ShelterCard";
import type { Shelter } from "@/types/shelter";

interface FrontPageShelterGridProps {
  shelters: Shelter[];
  maxVisible?: number;
}

/** Viser shelter-kort på forsiden og fjerner kort hvis billedet fejler; erstatter med næste shelter så vi holder ~12. */
export function FrontPageShelterGrid({
  shelters,
  maxVisible = 12,
}: FrontPageShelterGridProps) {
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((shelter: Shelter) => {
    setFailedIds((prev) => new Set(prev).add(shelter.id));
  }, []);

  const toShow = shelters
    .filter((s) => !failedIds.has(s.id))
    .slice(0, maxVisible);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {toShow.map((shelter) => (
          <ShelterCard
            key={shelter.id}
            shelter={shelter}
            onImageError={() => handleImageError(shelter)}
          />
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link
          href="/soeg"
          className="text-accent font-medium hover:underline"
        >
          Se alle shelters →
        </Link>
      </div>
    </>
  );
}
