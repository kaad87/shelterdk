import { ShelterCard } from "@/components/ShelterCard";
import type { Shelter } from "@/types/shelter";

interface FrontPageShelterGridProps {
  shelters: Shelter[];
  maxVisible?: number;
}

/** Viser shelter-kort på forsiden. Mobil: horisontalt karrusel. Desktop: grid. */
export function FrontPageShelterGrid({
  shelters,
  maxVisible = 12,
}: FrontPageShelterGridProps) {
  const toShow = shelters.slice(0, maxVisible);
  const priorityCount = 1;

  return (
    <>
      {/* Mobile: horizontal carousel */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
        {toShow.map((shelter, index) => (
          <div
            key={shelter.id}
            className="shrink-0 w-[200px] snap-start"
          >
            <ShelterCard
              shelter={shelter}
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Desktop: existing grid */}
      <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
        {toShow.map((shelter, index) => (
          <ShelterCard
            key={shelter.id}
            shelter={shelter}
            priority={index < priorityCount}
          />
        ))}
      </div>
    </>
  );
}
