"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookingCalendar } from "./BookingCalendar";
import type { AvailabilityResponse } from "@/types/booking";

interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BookingForm({ shelterSlug, shelterTitle, maxPersons }: BookingFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, "pending" | "confirmed" | "blocked">>({});
  const [dateRange, setDateRange] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_count: 1, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${shelterSlug}/availability`)
      .then((r) => r.json())
      .then((data: AvailabilityResponse) => setAvailability(data.dates ?? {}))
      .catch(() => {});
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

  const nights =
    dateRange
      ? Math.round(
          (new Date(dateRange.checkOut).getTime() - new Date(dateRange.checkIn).getTime()) /
            86_400_000
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-primary/8 pb-4">
        <p className="text-xs font-medium text-accent uppercase tracking-widest mb-1">Booking</p>
        <h1 className="font-serif text-2xl font-bold text-primary">{shelterTitle}</h1>
      </div>

      {/* Calendar section */}
      <div>
        <p className="text-sm font-medium text-primary mb-3">
          Vælg datoer
          <span className="text-primary/40 font-normal ml-1">— klik ankomst, derefter afrejse</span>
        </p>
        <div className="rounded-xl border border-primary/10 bg-white p-4 shadow-sm">
          <BookingCalendar
            unavailableDates={availability}
            onRangeSelect={setDateRange}
            maxPersons={maxPersons}
          />
        </div>
      </div>

      {/* Selected range summary */}
      {dateRange ? (
        <div className="rounded-xl bg-accent/8 border border-accent/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary/60">Ankomst</span>
            <span className="font-semibold text-primary">{formatDate(dateRange.checkIn)}</span>
          </div>
          <div className="w-px h-4 bg-primary/15" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary/60">Afrejse</span>
            <span className="font-semibold text-primary">{formatDate(dateRange.checkOut)}</span>
          </div>
          {nights > 0 && (
            <>
              <div className="w-px h-4 bg-primary/15" />
              <span className="text-xs text-primary/50">{nights} {nights === 1 ? "nat" : "nætter"}</span>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-primary/[0.03] border border-primary/8 px-4 py-3 text-sm text-primary/40 text-center">
          Ingen datoer valgt endnu
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Navn *</label>
            <input
              type="text" required maxLength={100}
              value={form.guest_name}
              onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
              placeholder="Dit fulde navn"
              className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition-colors placeholder:text-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Email *</label>
            <input
              type="email" required
              value={form.guest_email}
              onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
              placeholder="din@email.dk"
              className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition-colors placeholder:text-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Antal personer *
            <span className="text-primary/40 font-normal ml-1">(maks {maxPersons})</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, guest_count: Math.max(1, f.guest_count - 1) }))}
              className="w-9 h-9 rounded-full border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/5 transition-colors text-lg leading-none"
            >
              −
            </button>
            <span className="w-8 text-center font-semibold text-primary">{form.guest_count}</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, guest_count: Math.min(maxPersons, f.guest_count + 1) }))}
              className="w-9 h-9 rounded-full border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/5 transition-colors text-lg leading-none"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Besked til ejer
            <span className="text-primary/40 font-normal ml-1">(valgfri)</span>
          </label>
          <textarea
            maxLength={500} rows={3}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Skriv en hilsen eller spørgsmål til ejeren…"
            className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition-colors resize-none placeholder:text-primary/30"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !dateRange}
          className="w-full rounded-lg bg-accent text-white font-semibold py-3 text-sm hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {submitting ? "Sender forespørgsel…" : "Send bookingforespørgsel"}
        </button>

        <p className="text-xs text-primary/35 text-center leading-relaxed">
          Din forespørgsel sendes til ejeren, som bekræfter eller afviser. Du modtager svar på email.
        </p>
      </form>

      <div className="border-t border-primary/8 pt-4 text-center">
        <a href="https://shelterdk.dk" target="_blank" rel="noopener" className="text-xs text-primary/30 hover:text-primary/50 transition-colors">
          Leveret af ShelterDK
        </a>
      </div>
    </div>
  );
}
