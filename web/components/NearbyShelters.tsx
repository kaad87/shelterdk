import { slugifySegment } from "@/lib/slug";
import { getNearbyShelters, type NearbyShelter } from "@/lib/nearby-shelters";
import { ShelterCard } from "@/components/ShelterCard";

interface NearbySheltersProps {
  /** Koordinater for nuværende shelter (bruges til at finde nærliggende). */
  lat: number;
  lng: number;
  /** ID på det shelter vi viser – udelades fra listen. */
  excludeId: string;
  /** Max antal kort (default 5). */
  limit?: number;
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

/** X km: rund op til 1 decimal eller helt tal (fx 2.4 → "2.5", 3.0 → "3"). */
function formatMaxDistanceKm(distances: number[]): string {
  if (distances.length === 0) return "0";
  const max = Math.max(...distances);
  const rounded = Math.ceil(max * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

export async function NearbyShelters({
  lat,
  lng,
  excludeId,
  limit = 5,
}: NearbySheltersProps) {
  const nearby = await getNearbyShelters(lat, lng, excludeId, limit);
  if (nearby.length === 0) return null;

  const distances = nearby.map((s) => s.distance_km);
  const maxKm = formatMaxDistanceKm(distances);

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14 border-t border-primary/10">
      <h2 className="font-serif text-2xl font-bold text-primary mb-6">
        Andre steder inden for {maxKm} km
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Nærliggende shelters">
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
    </section>
  );
}
