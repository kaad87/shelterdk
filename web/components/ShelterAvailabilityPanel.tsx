"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type {
  ShelterAvailabilityResponse,
  ShelterAvailabilityState,
} from "@/types/booking";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";

interface ShelterAvailabilityPanelProps {
  slug: string;
  title: string;
  className?: string;
}

type CalendarMonth = {
  key: string;
  label: string;
  weeks: Array<Array<Date | null>>;
};

const WEEKDAY_LABELS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
const availabilityRequestCache = new Map<
  string,
  Promise<ShelterAvailabilityResponse>
>();
const availabilityDataCache = new Map<string, ShelterAvailabilityResponse>();

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatSyncTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthWeeks(monthDate: Date): Array<Array<Date | null>> {
  const firstDay = startOfMonth(monthDate);
  const jsWeekday = firstDay.getDay();
  const mondayOffset = jsWeekday === 0 ? 6 : jsWeekday - 1;
  const gridStart = addDays(firstDay, -mondayOffset);
  const weeks: Array<Array<Date | null>> = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: Array<Date | null> = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(gridStart, weekIndex * 7 + dayIndex);
      week.push(date.getMonth() === monthDate.getMonth() ? date : null);
    }
    if (week.some((d) => d !== null)) weeks.push(week);
  }

  return weeks;
}

function buildMonths(anchor: Date, count: number): CalendarMonth[] {
  return Array.from({ length: count }, (_, index) => {
    const monthDate = addMonths(anchor, index);
    return {
      key: getMonthKey(monthDate),
      label: getMonthLabel(monthDate),
      weeks: buildMonthWeeks(monthDate),
    };
  });
}

function getDayCellClasses(
  state: ShelterAvailabilityState | undefined,
  isPast: boolean,
  isToday: boolean
): string {
  const base = "relative flex aspect-square items-center justify-center rounded-lg text-[13px] font-medium select-none";

  if (isPast) return `${base} text-primary/20`;

  if (state === "booked" || state === "confirmed" || state === "blocked") {
    return `${base} bg-red-50 text-red-400 line-through`;
  }
  if (state === "partial" || state === "pending") {
    return `${base} bg-amber-50 text-amber-600`;
  }
  if (isToday) {
    return `${base} ring-2 ring-accent text-accent font-bold`;
  }
  return `${base} text-primary/80 hover:bg-primary/5`;
}

export function ShelterAvailabilityPanel({
  slug,
  title,
  className = "",
}: ShelterAvailabilityPanelProps) {
  const [availability, setAvailability] =
    useState<ShelterAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const loadAvailability = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        const cachedData = availabilityDataCache.get(slug);
        if (cachedData) {
          setAvailability(cachedData);
          return;
        }
      }

      let request = !force ? availabilityRequestCache.get(slug) : undefined;

      if (!request) {
        const url = new URL(
          `/api/shelter-availability/${slug}`,
          window.location.origin
        );
        url.searchParams.set("ts", String(Date.now()));

        request = fetch(url.toString(), {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }).then(async (res) => {
          const json = await res.json();
          if (!res.ok) {
            throw new Error(
              typeof json?.error === "string"
                ? json.error
                : "Kunne ikke hente ledighed lige nu."
            );
          }
          const parsed = json as ShelterAvailabilityResponse;
          availabilityDataCache.set(slug, parsed);
          return parsed;
        });
        availabilityRequestCache.set(slug, request);
      }

      const data = await request;
      setAvailability(data);
    } catch (err) {
      availabilityRequestCache.delete(slug);
      setError(err instanceof Error ? err.message : "Ukendt fejl");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingEnd = addDays(today, BOOKING_WINDOW_DAYS);
  const totalMonths = Math.max(
    1,
    (bookingEnd.getFullYear() - today.getFullYear()) * 12 +
      (bookingEnd.getMonth() - today.getMonth()) +
      1
  );
  const maxOffset = Math.max(0, totalMonths - 1);
  const clampedOffset = Math.min(Math.max(monthOffset, 0), maxOffset);
  const [visibleMonth] = buildMonths(addMonths(startOfMonth(today), clampedOffset), 1);
  const syncTime = availability ? formatSyncTime(availability.last_synced_at) : null;

  return (
    <section
      aria-labelledby="availability-heading"
      className={`rounded-2xl border border-primary/10 bg-white shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-primary/8">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-accent shrink-0" />
          <h2
            id="availability-heading"
            className="font-serif text-base font-bold text-primary"
          >
            Ledighed
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            availabilityRequestCache.delete(slug);
            availabilityDataCache.delete(slug);
            void loadAvailability(true);
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 px-2.5 py-1 text-xs text-primary/50 hover:bg-primary/5 disabled:opacity-40 transition-colors"
          aria-label="Opdatér ledighedsdata"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Opdatér
        </button>
      </div>

      <div className="px-5 pb-5 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-5 h-5 border-2 border-primary/10 border-t-accent rounded-full animate-spin" />
            <p className="text-xs text-primary/40">Henter ledighed…</p>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Ledighed ikke tilgængelig</p>
              <p className="mt-0.5 text-xs text-red-500">{error}</p>
            </div>
          </div>
        ) : !availability ? null : !availability.has_data ? (
          <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-primary">
              Ledighedsdata er ikke klar endnu
            </p>
            <p className="mt-1 text-xs leading-relaxed text-primary/55">
              Vi har ikke synkroniseret kalenderdata for dette shelter endnu.
              Brug bookingknappen ovenfor for at tjekke ledighed direkte hos{" "}
              {availability.provider === "naturstyrelsen"
                ? "Naturstyrelsen"
                : "bookingudbyderen"}
              .
            </p>
            {syncTime && (
              <p className="mt-3 text-xs text-primary/40">
                Senest forsøgt opdateret {syncTime}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMonthOffset((v) => Math.max(v - 1, 0))}
                disabled={clampedOffset === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/10 text-primary/40 hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                aria-label="Forrige måned"
              >
                <ChevronLeft size={15} />
              </button>
              <h3 className="font-serif text-sm font-bold text-primary capitalize">
                {visibleMonth.label}
              </h3>
              <button
                type="button"
                onClick={() => setMonthOffset((v) => Math.min(v + 1, maxOffset))}
                disabled={clampedOffset >= maxOffset}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/10 text-primary/40 hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                aria-label="Næste måned"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[11px] font-semibold uppercase tracking-wide text-primary/25 pb-1"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {visibleMonth.weeks.flat().map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                const key = isoDate(date);
                const state = availability.days[key];
                const isPast = date < today;
                const isToday = key === isoDate(today);

                return (
                  <div
                    key={key}
                    className={getDayCellClasses(state, isPast, isToday)}
                    title={
                      state === "booked" || state === "confirmed" || state === "blocked"
                        ? "Optaget"
                        : state === "partial" || state === "pending"
                          ? "Delvist optaget"
                          : isPast
                            ? ""
                            : "Ledig"
                    }
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-primary/45">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white border border-primary/15" />
                Ledig
              </span>
              <span className="flex items-center gap-1.5 text-xs text-primary/45">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100" />
                Afventer
              </span>
              <span className="flex items-center gap-1.5 text-xs text-primary/45">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-100" />
                Optaget
              </span>
            </div>

            {/* Footer note */}
            <div className="mt-4 pt-3.5 border-t border-primary/8">
              {availability.provider === "naturstyrelsen" ? (
                <p className="text-xs text-primary/40 leading-relaxed">
                  Data fra Naturstyrelsen
                  {syncTime && (
                    <> · Opdateret {syncTime}</>
                  )}
                  {availability.stale && (
                    <span className="text-amber-500"> · Kan være forældet</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-primary/40">
                  {syncTime ? `Opdateret ${syncTime}` : `Viser de næste ${BOOKING_WINDOW_DAYS} dage`}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
