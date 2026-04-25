"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookingCalendar } from "./BookingCalendar";
import type { AvailabilityResponse } from "@/types/booking";

interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
  description?: string | null;
}

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary/30">
      <path
        d={dir === "right" ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary/25">
      <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 1v4M12 1v4M2 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#c5a059" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookingForm({ shelterSlug, shelterTitle, maxPersons, description }: BookingFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, "pending" | "confirmed" | "blocked">>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [dateRange, setDateRange] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_count: 1, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${shelterSlug}/availability`)
      .then((r) => r.json())
      .then((data: AvailabilityResponse) => {
        setAvailability(data.dates ?? {});
        setLoadingAvailability(false);
      })
      .catch(() => setLoadingAvailability(false));
  }, [shelterSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange) { setError("Vælg ankomst- og afrejsedato"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/book/${shelterSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          check_in: dateRange.checkIn,
          check_out: dateRange.checkOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      router.push(`/embed/book/${shelterSlug}/tak`);
    } catch {
      setError("Noget gik galt. Tjek din forbindelse og prøv igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const nights = dateRange
    ? Math.round((new Date(dateRange.checkOut).getTime() - new Date(dateRange.checkIn).getTime()) / 86_400_000)
    : 0;

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1.5">Booking</p>
        <h1 className="font-serif text-3xl font-bold text-primary leading-tight">{shelterTitle}</h1>
        {description && (
          <p className="mt-2 text-sm text-primary/55 leading-relaxed line-clamp-2">{description}</p>
        )}
      </div>

      {/* Two-column grid on md+, single column on mobile */}
      <div className="grid md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">

        {/* ── LEFT: Calendar ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon />
            <h2 className="text-sm font-semibold text-primary">Vælg dine datoer</h2>
            <span className="text-sm text-primary/35">— klik ankomst, derefter afrejse</span>
          </div>

          <div className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
            {loadingAvailability ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-primary/15 border-t-accent rounded-full animate-spin" />
                <span className="text-xs text-primary/35">Henter tilgængelighed…</span>
              </div>
            ) : (
              <BookingCalendar
                unavailableDates={availability}
                onRangeSelect={setDateRange}
                maxPersons={maxPersons}
              />
            )}
          </div>

          {/* Trust signals – desktop only */}
          <div className="hidden md:flex flex-col gap-2 mt-5">
            {[
              "Gratis at sende en forespørgsel",
              "Du betaler ingenting nu",
              "Ejer svarer typisk inden 24 timer",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckIcon />
                </div>
                <span className="text-xs text-primary/50">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Summary + Form ── */}
        <div className="md:sticky md:top-6 space-y-4">

          {/* Date summary card */}
          {dateRange ? (
            <div className="rounded-2xl border border-accent/25 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-accent/15">
                <div className="px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-0.5">Ankomst</p>
                  <p className="text-[15px] font-bold text-primary leading-tight">{fmt(dateRange.checkIn)}</p>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-0.5">Afrejse</p>
                  <p className="text-[15px] font-bold text-primary leading-tight">{fmt(dateRange.checkOut)}</p>
                </div>
              </div>
              <div className="border-t border-accent/10 px-4 py-2 bg-accent/[0.03] flex items-center justify-between">
                <span className="text-xs text-primary/45">Varighed</span>
                <span className="text-xs font-semibold text-primary">{nights} {nights === 1 ? "nat" : "nætter"}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/15 bg-primary/[0.02] px-4 py-5 flex items-center gap-3">
              <CalendarIcon />
              <p className="text-sm text-primary/35">Vælg dine datoer i kalenderen</p>
            </div>
          )}

          {/* Form card */}
          <div className="rounded-2xl border border-primary/8 bg-white shadow-sm p-5">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name + email */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                    Navn *
                  </label>
                  <input
                    type="text" required maxLength={100}
                    value={form.guest_name}
                    onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
                    placeholder="Dit fulde navn"
                    className="w-full rounded-xl border border-primary/15 bg-primary/[0.02] px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email" required
                    value={form.guest_email}
                    onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
                    placeholder="din@email.dk"
                    className="w-full rounded-xl border border-primary/15 bg-primary/[0.02] px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                  />
                </div>
              </div>

              {/* Antal personer */}
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                  Antal personer *
                  <span className="normal-case font-normal text-primary/35 ml-1">maks {maxPersons}</span>
                </label>
                <div className="flex items-center gap-0 rounded-xl border border-primary/15 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, guest_count: Math.max(1, f.guest_count - 1) }))}
                    disabled={form.guest_count <= 1}
                    className="w-10 h-10 flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 border-r border-primary/10"
                  >
                    <span className="text-lg leading-none mb-0.5">−</span>
                  </button>
                  <span className="w-12 text-center text-sm font-semibold text-primary tabular-nums">
                    {form.guest_count}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, guest_count: Math.min(maxPersons, f.guest_count + 1) }))}
                    disabled={form.guest_count >= maxPersons}
                    className="w-10 h-10 flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 border-l border-primary/10"
                  >
                    <span className="text-lg leading-none mb-0.5">+</span>
                  </button>
                </div>
              </div>

              {/* Besked */}
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                  Besked til ejer
                  <span className="normal-case font-normal text-primary/35 ml-1">valgfri</span>
                </label>
                <textarea
                  maxLength={500} rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Skriv et par ord til ejeren…"
                  className="w-full rounded-xl border border-primary/15 bg-primary/[0.02] px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-none"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* CTA */}
              <button
                type="submit"
                disabled={submitting || !dateRange}
                className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200
                  bg-accent text-white shadow-sm
                  hover:bg-[#b8923f] hover:shadow-md active:scale-[0.98]
                  disabled:bg-primary/10 disabled:text-primary/30 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sender…
                  </span>
                ) : dateRange ? (
                  "Send bookingforespørgsel"
                ) : (
                  "Vælg datoer for at fortsætte"
                )}
              </button>

              <p className="text-[11px] text-primary/30 text-center leading-relaxed">
                Gratis · uforpligtende · ingen betaling nu
              </p>
            </form>
          </div>

          {/* Trust – mobile only */}
          <div className="flex md:hidden flex-col gap-2 pt-1">
            {[
              "Gratis at sende en forespørgsel",
              "Du betaler ingenting nu",
              "Ejer svarer typisk inden 24 timer",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckIcon />
                </div>
                <span className="text-xs text-primary/50">{t}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
