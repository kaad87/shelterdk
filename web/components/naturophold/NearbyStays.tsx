import { getNearbyStays } from "@/lib/nature-stays";
import { StayCard } from "@/components/naturophold/StayCard";

/**
 * Plan B på shelter-sider: viser de nærmeste publicerede naturophold (glamping
 * m.m.) inden for radius. Altid-på & komplementær — INGEN ledigheds-påstand.
 * Skjules helt hvis der ikke er noget i nærheden.
 */
export async function NearbyStays({
  coords,
  radiusKm = 25,
  limit = 3,
}: {
  coords: { lat: number; lon: number } | null;
  radiusKm?: number;
  limit?: number;
}) {
  if (!coords) return null;
  const stays = await getNearbyStays(coords.lat, coords.lon, { radiusKm, limit });
  if (stays.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 border-t border-primary/10">
      <h2 className="font-serif text-2xl font-bold text-primary">Vil du have luksus i samme natur?</h2>
      <p className="mt-1 text-primary/70">
        Glamping og naturophold i nærheden — hvis du foretrækker en seng, varme og udsigt frem for liggeunderlag.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stays.map((s) => (
          <StayCard key={s.id} stay={s} distanceKm={s.distance_km} position="naturophold_planb" />
        ))}
      </div>
    </section>
  );
}
