"use client";

// Trin 1 — Om shelteret: navn, placering, kapacitet, beskrivelse, booking-URL.

interface StepAboutProps {
  shelterName: string;
  setShelterName: (v: string) => void;
  locationText: string;
  setLocationText: (v: string) => void;
  capacity: string;
  setCapacity: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  bookingUrl: string;
  setBookingUrl: (v: string) => void;
}

export function StepAbout({
  shelterName,
  setShelterName,
  locationText,
  setLocationText,
  capacity,
  setCapacity,
  description,
  setDescription,
  bookingUrl,
  setBookingUrl,
}: StepAboutProps) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="wizard-name"
          className="block text-sm font-medium text-primary/80 mb-1"
        >
          Shelterets navn <span className="text-red-500">*</span>
        </label>
        <input
          id="wizard-name"
          type="text"
          value={shelterName}
          onChange={(e) => setShelterName(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="fx Skovhytten ved Esrum Sø"
        />
      </div>
      <div>
        <label
          htmlFor="wizard-location"
          className="block text-sm font-medium text-primary/80 mb-1"
        >
          Placering <span className="text-red-500">*</span>
        </label>
        <input
          id="wizard-location"
          type="text"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="fx Gribskov, tæt på Esrum Sø"
        />
      </div>
      <div>
        <label
          htmlFor="wizard-capacity"
          className="block text-sm font-medium text-primary/80 mb-1"
        >
          Kapacitet (antal personer)
        </label>
        <input
          id="wizard-capacity"
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          min={1}
          className="w-32 rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="fx 6"
        />
      </div>
      <div>
        <label
          htmlFor="wizard-description"
          className="block text-sm font-medium text-primary/80 mb-1"
        >
          Beskrivelse
        </label>
        <textarea
          id="wizard-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={4}
          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="Beskriv shelteret..."
        />
      </div>
      <div>
        <label
          htmlFor="wizard-booking-url"
          className="block text-sm font-medium text-primary/80 mb-1"
        >
          Booking-URL
        </label>
        <input
          id="wizard-booking-url"
          type="url"
          value={bookingUrl}
          onChange={(e) => setBookingUrl(e.target.value)}
          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
