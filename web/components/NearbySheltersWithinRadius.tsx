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

/**
 * Suspense-fallback der reserverer plads svarende til det færdige modul.
 *
 * Nødvendigt fordi modulet flyttede fra bunden af siden til midten, med en
 * annonce og alt det øvrige indhold under sig. Med en lav placeholder ville de
 * ~2.400 px indhold, der streames ind, skubbe hele resten af siden nedad — et
 * groft layout-hop lige over en annonce. Skelettet efterligner derfor grid'et
 * med kort i samme størrelsesforhold, så højden er tæt på den endelige.
 *
 * Holdes i samme fil som modulet, så de to ikke skrider fra hinanden.
 */
export function NearbySheltersSkeleton({ count = 5 }: { count?: number }) {
  return (
    <section className="mb-10" aria-hidden>
      <div className="h-7 w-56 bg-primary/5 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-primary/10 overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-primary/5" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 bg-primary/5 rounded" />
              <div className="h-4 w-1/2 bg-primary/5 rounded" />
              <div className="h-4 w-1/3 bg-primary/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

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
    // Ligger inde i artikel-kolonnen på shelter-detaljesiden (som nearbySlot),
    // ikke længere som selvstændig sektion efter siden. Derfor ingen egen
    // sidebredde, vandret padding eller topkant — den ydre kolonne styrer det.
    <section className="mb-10" aria-labelledby="heading-nearby-shelters">
      <h2
        id="heading-nearby-shelters"
        className="font-serif text-xl font-bold text-primary mb-4"
      >
        Andre steder inden for {radiusKm} km
      </h2>
      {nearby.length > 0 ? (
        <ul
          // Højst 2 kolonner: modulet bor nu i artikel-kolonnen, som deler
          // pladsen med en 340px sidebar. Tre kolonner ville give ~204px brede
          // kort på desktop.
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
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
