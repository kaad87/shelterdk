"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { CalendarDays, ArrowRight } from "lucide-react";

function getWeekendDates(weeksAhead: number): { sat: string; sun: string } {
  const today = new Date();
  const day = today.getDay();
  const daysUntilSat = day === 6 ? 7 * weeksAhead : (6 - day) + 7 * (weeksAhead - 1);
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { sat: fmt(sat), sun: fmt(sun) };
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(
    new Date(iso + "T12:00:00")
  );
}

export function WeekendCTACard() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [todayIso, setTodayIso] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isSunday, setIsSunday] = useState(false);

  useEffect(() => {
    const { sat, sun } = getWeekendDates(1);
    const d = new Date();
    const fmt = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    setDateFrom(sat);
    setDateTo(sun);
    setTodayIso(fmt(d));
    setIsSunday(d.getDay() === 0);
    setMounted(true);
  }, []);

  function handleSearch() {
    if (!dateFrom) return;
    const params = new URLSearchParams({ date: dateFrom, confirmed_available: "1" });
    if (dateTo && dateTo >= dateFrom) params.set("date_to", dateTo);
    router.push(`/soeg?${params.toString()}`);
  }

  function setWeekend(weeksAhead: number) {
    const { sat, sun } = getWeekendDates(weeksAhead);
    setDateFrom(sat);
    setDateTo(sun);
  }

  const thisWeekend = mounted ? getWeekendDates(1) : { sat: "", sun: "" };
  const nextWeekend = mounted ? getWeekendDates(2) : { sat: "", sun: "" };
  const isThisWeekend = dateFrom === thisWeekend.sat && dateTo === thisWeekend.sun;
  const isNextWeekend = dateFrom === nextWeekend.sat && dateTo === nextWeekend.sun;

  return (
    <section className="py-5 md:py-8 bg-background" aria-labelledby="heading-weekend-cta">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border border-primary/10 p-4 sm:p-5 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-10">

            {/* Heading */}
            <div className="md:w-56 shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={18} className="text-accent shrink-0" aria-hidden />
                <h2 id="heading-weekend-cta" className="font-serif text-lg md:text-xl font-bold text-primary leading-tight">
                  Planlæg din weekendtur
                </h2>
              </div>
              <p className="text-primary/60 text-sm leading-relaxed max-w-md">
                Find shelters der er ledige til dit ophold
              </p>
            </div>

            {/* Date controls */}
            <div className="flex-1">
              {/* Quick picks */}
              <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
                {[1, 2].map((w) => {
                  const { sat, sun } = w === 1 ? thisWeekend : nextWeekend;
                  const active = w === 1 ? isThisWeekend : isNextWeekend;
                  const label = w === 1
                    ? (isSunday ? "Næste weekend" : "Denne weekend")
                    : (isSunday ? "Weekenden derefter" : "Næste weekend");
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWeekend(w)}
                      className={`text-sm font-medium px-3.5 md:px-4 py-2 rounded-full border transition-colors ${
                        active
                          ? "bg-primary text-white border-primary"
                          : "bg-white border-primary/15 text-primary/70 hover:border-primary/30 hover:text-primary"
                      }`}
                    >
                      {label}
                      {mounted && sat && (
                        <span className="hidden sm:inline text-xs opacity-70 ml-1.5">
                          {formatShortDate(sat).replace(/\s\d{4}$/, "")}
                          {" – "}
                          {formatShortDate(sun).replace(/\s\d{4}$/, "")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom date inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wkd-from" className="text-[11px] font-semibold text-primary/50 uppercase tracking-wide whitespace-nowrap">
                    Ankomst
                  </label>
                  <input
                    id="wkd-from"
                    type="date"
                    value={dateFrom}
                    min={todayIso}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      if (dateTo && e.target.value > dateTo) setDateTo("");
                    }}
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 [color-scheme:light]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wkd-to" className="text-[11px] font-semibold text-primary/50 uppercase tracking-wide whitespace-nowrap">
                    Afgang
                  </label>
                  <input
                    id="wkd-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom || todayIso}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 [color-scheme:light]"
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleSearch}
                disabled={!dateFrom}
                className="w-full md:w-auto justify-center flex items-center gap-2 rounded-xl bg-accent-dark px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Søg ledige shelters
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
