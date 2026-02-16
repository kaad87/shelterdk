import { slugifySegment } from "@/lib/slug";
import {
  getNearbyShelters,
  getNearbySheltersWithinRadius,
  type NearbyShelter,
} from "@/lib/nearby-shelters";
import { ShelterCard } from "@/components/ShelterCard";

interface NearbySheltersWithinRadiusProps {
  /** ID på det aktuelle shelter (bruges til at hente nærliggende inden for radius). */
  shelterId: string;
  /** Radius i km (default 10). */
  radiusKm?: number;
  /** Max antal kort (default 5). */
  limit?: number;
  /** Koordinater – bruges som fallback hvis radius-RPC returnerer tom (fx getLocationCoords(shelter)). */
  coords?: { lat: number; lon: number } | null;
}

function shelterHref(
  region: string | null,
  kommune: string | null,
  slug: string
): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

const RADIUS_KM_DEFAULT = 10;

export async function NearbySheltersWithinRadius({
  shelterId,
  radiusKm = RADIUS_KM_DEFAULT,
  limit = 5,
  coords = null,
}: NearbySheltersWithinRadiusProps) {
  let nearby = await getNearbySheltersWithinRadius(shelterId, radiusKm, limit);
  if (nearby.length === 0 && coords) {
    nearby = await getNearbyShelters(coords.lat, coords.lon, shelterId, limit);
  }

  return (
    <section
      className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14 border-t border-primary/10"
      aria-labelledby="heading-nearby-shelters"
    >
      <h2
        id="heading-nearby-shelters"
        className="font-serif text-2xl font-bold text-primary mb-6"
      >
        Andre steder inden for {radiusKm} km
      </h2>
      {nearby.length > 0 ? (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-label={`Nærliggende shelters inden for ${radiusKm} km`}
        >
          {nearby.map((shelter) => (
            <li key={shelter.id}>
              <ShelterCard
                shelter={shelter as NearbyShelter}
                href={shelterHref(
                  shelter.region ?? null,
                  shelter.kommune ?? null,
                  shelter.slug
                )}
              />
              {shelter.distance_km != null && (
                <p className="mt-1 text-sm text-primary/60">
                  {shelter.distance_km} km væk
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-primary/70">
          Ingen andre shelters fundet i nærheden. Prøv at søge på{" "}
          <a href="/soeg" className="text-accent hover:underline">
            søgesiden
          </a>{" "}
          for at finde flere shelters.
        </p>
      )}
    </section>
  );
}
