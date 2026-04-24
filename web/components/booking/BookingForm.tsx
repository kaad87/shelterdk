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
        body: JSON.stringify({ ...form, ...dateRange }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      // Navigate to tak-page (spec: "Bruger lander på /embed/book/[slug]/tak")
      router.push(`/embed/book/${shelterSlug}/tak`);
    } catch {
      setError("Noget gik galt. Tjek din forbindelse og prøv igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold text-primary">Book {shelterTitle}</h1>

      <BookingCalendar
        unavailableDates={availability}
        onRangeSelect={setDateRange}
        maxPersons={maxPersons}
      />

      {dateRange && (
        <p className="text-sm text-primary/70 bg-primary/5 rounded-lg px-3 py-2">
          Valgt: <strong>{dateRange.checkIn}</strong> → <strong>{dateRange.checkOut}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Navn *</label>
          <input
            type="text" required maxLength={100}
            value={form.guest_name}
            onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Email *</label>
          <input
            type="email" required
            value={form.guest_email}
            onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Antal personer * (maks {maxPersons})
          </label>
          <input
            type="number" required min={1} max={maxPersons}
            value={form.guest_count}
            onChange={(e) => setForm((f) => ({ ...f, guest_count: Number(e.target.value) }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Besked til ejer (valgfri)</label>
          <textarea
            maxLength={500} rows={3}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit" disabled={submitting || !dateRange}
          className="w-full rounded-lg bg-accent text-white font-semibold py-3 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Sender…" : "Send bookingforespørgsel"}
        </button>
      </form>

      <p className="text-xs text-primary/40 text-center">
        Leveret af{" "}
        <a href="https://shelterdk.dk" target="_blank" rel="noopener" className="underline">
          ShelterDK
        </a>
      </p>
    </div>
  );
}
