import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser, getDashboardSummaries } from "@/lib/owner-db";
import type { DashboardShelterSummary } from "@/lib/owner-db";
import type { BookableShelter } from "@/types/booking";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function stripUnitSuffix(title: string) {
  return title.replace(/\s+[–-]\s+Shelter\s+\d+(?:\s+[–-]\s+.+)?$/i, "").trim();
}

function getUnitNumber(title: string): number {
  const match = title.match(/Shelter\s+(\d+)$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function formatCheckInDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });
}

function firstInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs text-primary/45 bg-primary/[0.04] border border-primary/8 rounded-full px-2.5 py-0.5">
      {children}
    </span>
  );
}

function getUnitPublicPath(unit: Pick<BookableShelter, "slug" | "booking_mode">): string | null {
  if (!unit.slug || unit.booking_mode === "iframe") return null;
  return `/book/${unit.slug}`;
}

function SingleUnitCard({
  unit,
  summary,
}: {
  unit: BookableShelter & { active_booking_count: number };
  summary: DashboardShelterSummary;
}) {
  const hasPending = summary.pendingCount > 0;
  const hasNextCheckIn = Boolean(summary.nextCheckIn);
  const isIdle = !hasPending && !hasNextCheckIn && unit.active_booking_count === 0;
  const publicPath = getUnitPublicPath(unit);

  return (
    <div className="rounded-2xl border border-primary/8 bg-white overflow-hidden">
      {/* Pending alert banner */}
      {hasPending && (
        <Link
          href={`/ejer/shelter/${unit.id}/bookinger`}
          className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-5 py-3 hover:bg-amber-100 transition-colors group"
        >
          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-semibold text-amber-800">
            {summary.pendingCount === 1
              ? "1 forespørgsel afventer dit svar"
              : `${summary.pendingCount} forespørgsler afventer dit svar`}
          </span>
          <span className="ml-auto text-amber-500 group-hover:translate-x-0.5 transition-transform text-base">→</span>
        </Link>
      )}

      <div className="px-6 pt-5 pb-6">
        {/* Title + public URL */}
        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-primary leading-snug mb-1">
            {unit.title}
          </h2>
          {publicPath && (
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary/35 hover:text-accent transition-colors"
            >
              {SITE_ORIGIN}
              {publicPath}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="opacity-70">
                <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}
        </div>

        {/* Status / next check-in */}
        <div className="mb-5">
          {hasNextCheckIn && summary.nextCheckIn ? (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm text-primary/70">
                Næste ankomst{" "}
                <span className="font-semibold text-primary">
                  {formatCheckInDate(summary.nextCheckIn.date)}
                </span>
                {" — "}
                <span className="text-primary/70">{firstInitial(summary.nextCheckIn.guestName)}</span>
              </span>
              {unit.active_booking_count > 1 && (
                <span className="text-xs text-primary/35">
                  + {unit.active_booking_count - 1} flere
                </span>
              )}
            </div>
          ) : unit.active_booking_count > 0 ? (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm text-primary/70">
                <span className="font-semibold text-primary">{unit.active_booking_count}</span>{" "}
                aktive {unit.active_booking_count === 1 ? "booking" : "bookinger"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-primary/40">Ingen kommende bookinger</p>
          )}
        </div>

        {/* Shelter metadata */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          <MetaPill>
            <svg className="mr-1 opacity-60" width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1a2 2 0 1 1 0 4A2 2 0 0 1 6 1zm0 5c-2.67 0-4 1.34-4 2v1h8V8c0-.66-1.33-2-4-2z" fill="currentColor"/>
            </svg>
            Maks {unit.max_persons} pers.
          </MetaPill>
          {unit.shelter_price_dkk != null && unit.shelter_price_dkk > 0 ? (
            <MetaPill>{unit.shelter_price_dkk} kr/nat</MetaPill>
          ) : (
            <MetaPill>Gratis</MetaPill>
          )}
          <MetaPill>
            {unit.payment_mode === "after_confirmation" ? "Bekræft først" : "Betal straks"}
          </MetaPill>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={`/ejer/shelter/${unit.id}/bookinger`}
            className={`flex-1 sm:flex-none text-center text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors ${
              hasPending
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            {hasPending ? `Se ${summary.pendingCount === 1 ? "forespørgsel" : "forespørgsler"}` : "Se bookinger"}
          </Link>
          <Link
            href={`/ejer/shelter/${unit.id}/rediger`}
            className="flex-1 sm:flex-none text-center text-sm font-medium text-accent border border-accent/30 rounded-xl px-5 py-2.5 hover:bg-accent/5 transition-colors"
          >
            Rediger shelter
          </Link>
        </div>
      </div>

      {/* Bottom hint when idle */}
      {isIdle && publicPath && (
        <div className="border-t border-primary/6 bg-primary/[0.018] px-6 py-3">
          <p className="text-xs text-primary/40 mb-0.5">Del bookinglinket for at tiltrække gæster</p>
          <p className="text-xs font-medium text-primary/55 select-all">{SITE_ORIGIN}{publicPath}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function EjerDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const shelters = await getSheltersByAuthUser(user.id);

  const summaries = await getDashboardSummaries(
    shelters.map((s) => s.id),
    shelters.filter((s) => s.payment_mode === "after_confirmation").map((s) => s.id)
  );
  const summaryMap = new Map(summaries.map((s) => [s.shelterId, s]));

  const groupedShelters = shelters.reduce((acc, shelter) => {
    const key = shelter.shelter_id ?? shelter.id;
    const existing = acc.get(key);
    if (existing) {
      existing.units.push(shelter);
      existing.activeBookingCount += shelter.active_booking_count;
      existing.pendingCount += summaryMap.get(shelter.id)?.pendingCount ?? 0;
      return acc;
    }
    acc.set(key, {
      key,
      units: [shelter],
      activeBookingCount: shelter.active_booking_count,
      pendingCount: summaryMap.get(shelter.id)?.pendingCount ?? 0,
    });
    return acc;
  }, new Map<string, {
    key: string;
    units: typeof shelters;
    activeBookingCount: number;
    pendingCount: number;
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

  const totalPending = shelterGroups.reduce((sum, g) => sum + g.pendingCount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-primary">Mine shelters</h1>
          <p className="text-xs text-primary/35 mt-0.5">{user.email}</p>
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

      {/* Global pending notice (only when multiple shelters) */}
      {totalPending > 0 && shelterGroups.length > 1 && (
        <div className="mb-5 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            {totalPending === 1
              ? "1 forespørgsel kræver din reaktion"
              : `${totalPending} forespørgsler kræver din reaktion`}
          </p>
        </div>
      )}

      {shelters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/15 p-10 text-center">
          <p className="text-sm text-primary/50 mb-1">Ingen shelters tilknyttet denne konto.</p>
          <p className="text-xs text-primary/35">Skriv til kontakt@shelterdk.dk hvis du mangler adgang.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shelterGroups.map((group) =>
            group.isMultiUnit ? (
              /* Multi-unit group */
              <section
                key={group.key}
                className="rounded-2xl border border-primary/8 bg-white overflow-hidden"
              >
                {group.pendingCount > 0 && (
                  <div className="flex items-center gap-2.5 bg-amber-50 border-b border-amber-200 px-5 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-sm font-semibold text-amber-800">
                      {group.pendingCount === 1
                        ? "1 forespørgsel afventer svar på denne plads"
                        : `${group.pendingCount} forespørgsler afventer svar på denne plads`}
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
                    <div>
                      <h2 className="font-serif text-lg font-bold text-primary">{group.label}</h2>
                      <p className="text-xs text-primary/40 mt-1">
                        {group.activeBookingCount > 0
                          ? `${group.activeBookingCount} aktive bookinger · ${group.units.length} enheder`
                          : `${group.units.length} enheder · ingen aktive bookinger`}
                      </p>
                    </div>
                    <Link
                      href={`/ejer/plads/${group.key}/rediger`}
                      className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors shrink-0"
                    >
                      Fælles indstillinger
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {group.units.map((unit) => {
                      const unitSummary = summaryMap.get(unit.id);
                      const unitPending = unitSummary?.pendingCount ?? 0;
                      return (
                        <div
                          key={unit.id}
                          className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <h3 className="text-sm font-semibold text-primary">{unit.title}</h3>
                            <div className="mt-1 flex flex-wrap gap-2 items-center">
                              {unitPending > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                                  {unitPending} afventer svar
                                </span>
                              )}
                              {unit.active_booking_count > 0 && (
                                <span className="text-xs text-primary/45">
                                  {unit.active_booking_count} aktive
                                </span>
                              )}
                              {unitPending === 0 && unit.active_booking_count === 0 && (
                                <span className="text-xs text-primary/35">Ingen aktive bookinger</span>
                              )}
                            </div>
                          </div>
                          <Link
                            href={`/ejer/shelter/${unit.id}/bookinger`}
                            className={`text-sm font-medium rounded-lg px-4 py-2 shrink-0 text-center transition-colors ${
                              unitPending > 0
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "bg-primary text-white hover:bg-primary/90"
                            }`}
                          >
                            {unitPending > 0 ? "Se forespørgsler" : "Se bookinger"}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : (
              /* Single unit */
              <SingleUnitCard
                key={group.units[0].id}
                unit={group.units[0]}
                summary={summaryMap.get(group.units[0].id) ?? {
                  shelterId: group.units[0].id,
                  pendingCount: 0,
                  nextCheckIn: null,
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
