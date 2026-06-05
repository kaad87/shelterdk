import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ShelterCard } from "@/components/ShelterCard";
import { getNewShelters, isNewShelter, newShelterHref } from "@/lib/new-shelters";

/**
 * Forside-strip med de senest tilføjede (præsentable) shelters.
 * Skjuler sig selv hvis der er færre end MIN_TO_SHOW — vi vil ikke vise en
 * halvtom "nyheds"-flade. Henter selv sine data (async server component).
 */
const STRIP_LIMIT = 4; // én ren række på desktop (4 kort)
const MIN_TO_SHOW = 4;

export async function NyeSheltersStrip() {
  const shelters = await getNewShelters({ sinceDays: 14, limit: STRIP_LIMIT, presentableOnly: true });
  if (shelters.length < MIN_TO_SHOW) return null;

  return (
    <section className="py-8 bg-background" aria-labelledby="heading-nye-shelters">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2
              id="heading-nye-shelters"
              className="flex items-center gap-2 font-serif text-3xl font-bold text-primary"
            >
              <Sparkles size={26} className="text-accent" aria-hidden="true" />
              Nye shelters
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Senest tilføjet til ShelterDK
            </p>
          </div>
          <Link
            href="/nye"
            className="shrink-0 text-sm font-medium text-accent hover:underline"
          >
            Se alle →
          </Link>
        </div>

        {/* Mobile: horisontal scroll (carousel slukket pr. card for at undgå
            nested swipe-konflikt — som på "Populære shelters"). */}
        <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
          {shelters.map((shelter, index) => (
            <div key={shelter.id} className="shrink-0 w-[200px] snap-start">
              <ShelterCard
                shelter={shelter}
                href={newShelterHref(shelter)}
                isNew={isNewShelter(shelter)}
                priority={index === 0}
                disableCarousel
              />
            </div>
          ))}
        </div>

        {/* Desktop: én række på 4 */}
        <div className="hidden md:grid grid-cols-4 gap-4 lg:gap-5">
          {shelters.map((shelter) => (
            <ShelterCard
              key={shelter.id}
              shelter={shelter}
              href={newShelterHref(shelter)}
              isNew={isNewShelter(shelter)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
