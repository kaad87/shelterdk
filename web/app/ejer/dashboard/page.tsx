import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

function stripUnitSuffix(title: string) {
  return title.replace(/\s+[–-]\s+Shelter\s+\d+(?:\s+[–-]\s+.+)?$/i, "").trim();
}

function getUnitNumber(title: string): number {
  const match = title.match(/Shelter\s+(\d+)$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export default async function EjerDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const shelters = await getSheltersByAuthUser(user.id);
  const groupedShelters = shelters.reduce((acc, shelter) => {
    const key = shelter.shelter_id ?? shelter.id;
    const existing = acc.get(key);
    if (existing) {
      existing.units.push(shelter);
      existing.activeBookingCount += shelter.active_booking_count;
      return acc;
    }
    acc.set(key, {
      key,
      units: [shelter],
      activeBookingCount: shelter.active_booking_count,
    });
    return acc;
  }, new Map<string, {
    key: string;
    units: typeof shelters;
    activeBookingCount: number;
  }>());
  const shelterGroups = Array.from(groupedShelters.values()).map((group) => {
    const first = group.units[0];
    const isMultiUnit = group.units.length > 1 && Boolean(first.shelter_id);
    const sortedUnits = [...group.units].sort((a, b) => {
      const unitDiff = getUnitNumber(a.title) - getUnitNumber(b.title);
      return unitDiff !== 0 ? unitDiff : a.title.localeCompare(b.title, "da");
    });
    return {
      ...group,
      units: sortedUnits,
      isMultiUnit,
      label: isMultiUnit ? stripUnitSuffix(first.title) : first.title,
    };
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Ejer-portal</p>
          <h1 className="font-serif text-2xl font-bold text-primary">Mine shelters</h1>
          <p className="text-sm text-primary/50 mt-1">{user.email}</p>
        </div>
        <form action="/api/ejer/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-primary/40 hover:text-primary border border-primary/15 rounded-lg px-3 py-1.5 transition-colors"
          >
            Log ud
          </button>
        </form>
      </div>

      {shelters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/15 p-8 text-center">
          <p className="text-sm text-primary/50">Ingen shelters fundet. Kontakt os på kontakt@shelterdk.dk.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shelterGroups.map((group) => (
            group.isMultiUnit ? (
              <section
                key={group.key}
                className="rounded-2xl border border-primary/8 bg-white p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-primary">{group.label}</h2>
                    <p className="text-xs text-primary/40 mt-0.5">
                      {group.activeBookingCount > 0
                        ? `${group.activeBookingCount} aktive bookinger på tværs af ${group.units.length} shelters`
                        : `${group.units.length} shelters på samme plads`}
                    </p>
                    <p className="text-xs text-primary/55 mt-2">
                      Offentlig shelterside og billeder deles, men bookinger styres separat for hver enhed.
                    </p>
                  </div>
                  <Link
                    href={`/ejer/plads/${group.key}/rediger`}
                    className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors shrink-0"
                  >
                    Rediger fælles indstillinger
                  </Link>
                </div>

                <div className="mt-4 space-y-2">
                  {group.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-primary">{unit.title}</h3>
                        <p className="text-xs text-primary/45 mt-0.5">
                          {unit.active_booking_count > 0
                            ? `${unit.active_booking_count} aktive bookinger`
                            : "Ingen aktive bookinger"}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link
                          href={`/ejer/shelter/${unit.id}/bookinger`}
                          className="text-sm font-medium text-primary border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                        >
                          Bookinger
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div
                key={group.units[0].id}
                className="rounded-2xl border border-primary/8 bg-white p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <h2 className="font-semibold text-primary">{group.units[0].title}</h2>
                  <p className="text-xs text-primary/40 mt-0.5">
                    {group.units[0].active_booking_count > 0
                      ? `${group.units[0].active_booking_count} aktive bookinger`
                      : "Ingen aktive bookinger"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/ejer/shelter/${group.units[0].id}/bookinger`}
                    className="text-sm font-medium text-primary border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                  >
                    Bookinger
                  </Link>
                  <Link
                    href={`/ejer/shelter/${group.units[0].id}/rediger`}
                    className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors"
                  >
                    Rediger
                  </Link>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
