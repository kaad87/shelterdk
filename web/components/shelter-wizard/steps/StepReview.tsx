"use client";

import { FACILITY_KEYS, FACILITY_LABELS } from "@/lib/shelter-submissions";
import type { FacilityKey } from "@/lib/shelter-submissions";

// Trin 6 — Gennemse & send: opsummering + kontaktfelter + honeypot.
// Selve afsendelsen sker via wizardens Send-knap i bunden.

interface StepReviewProps {
  shelterName: string;
  locationText: string;
  capacity: string;
  description: string;
  bookingUrl: string;
  facilities: Partial<Record<FacilityKey, boolean>>;
  lat: number | null;
  lng: number | null;
  photoCount: number;
  wantsBooking: boolean;
  contactName: string;
  setContactName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-primary/5 last:border-0">
      <dt className="text-primary/50">{label}</dt>
      <dd className="text-primary/80 text-right font-medium">{value}</dd>
    </div>
  );
}

export function StepReview({
  shelterName,
  locationText,
  capacity,
  description,
  bookingUrl,
  facilities,
  lat,
  lng,
  photoCount,
  wantsBooking,
  contactName,
  setContactName,
  contactEmail,
  setContactEmail,
  website,
  setWebsite,
}: StepReviewProps) {
  const chosenFacilities = FACILITY_KEYS.filter((k) => facilities[k]).map(
    (k) => FACILITY_LABELS[k]
  );

  return (
    <div className="space-y-6">
      {/* Opsummering */}
      <dl className="rounded-xl border border-primary/10 bg-pine/5 p-4 text-sm">
        <SummaryRow label="Navn" value={shelterName || "—"} />
        <SummaryRow label="Placering" value={locationText || "—"} />
        <SummaryRow label="Kapacitet" value={capacity || "—"} />
        <SummaryRow
          label="Koordinater"
          value={
            lat != null && lng != null
              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : "Ikke sat"
          }
        />
        <SummaryRow
          label="Faciliteter"
          value={chosenFacilities.length ? chosenFacilities.join(", ") : "Ingen"}
        />
        <SummaryRow label="Billeder" value={String(photoCount)} />
        <SummaryRow label="Booking-URL" value={bookingUrl || "—"} />
        <SummaryRow
          label="Bookingsystem"
          value={wantsBooking ? "Ønskes aktiveret" : "Nej tak"}
        />
        {description.trim() && (
          <SummaryRow label="Beskrivelse" value={description.trim()} />
        )}
      </dl>

      {/* Kontaktfelter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="wizard-contact-name"
            className="block text-sm font-medium text-primary/80 mb-1"
          >
            Dit navn
          </label>
          <input
            id="wizard-contact-name"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Valgfrit"
          />
        </div>
        <div>
          <label
            htmlFor="wizard-contact-email"
            className="block text-sm font-medium text-primary/80 mb-1"
          >
            Din email <span className="text-red-500">*</span>
          </label>
          <input
            id="wizard-contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="du@eksempel.dk"
          />
        </div>
      </div>

      {/* Honeypot — skjult for rigtige brugere */}
      <div className="sr-only" aria-hidden="true">
        <label>
          Hjemmeside
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
