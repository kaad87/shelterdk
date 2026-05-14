"use client";

import dynamic from "next/dynamic";
import { useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { FACILITY_KEYS, FACILITY_LABELS } from "@/lib/shelter-submissions";
import type { FacilityKey } from "@/lib/shelter-submissions";

// ─── Leaflet map picker (SSR disabled) ────────────────────────────────────────

const SubmissionMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, LayersControl, Marker, useMapEvents } =
      await import("react-leaflet");
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({
          click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }

      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [56.0, 10.0];

      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 300, width: "100%" }}
          className="rounded-xl z-0 [&_.leaflet-control-attribution]:text-[10px]"
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Kort">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellit">
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedPhoto {
  path: string;
  previewUrl: string | null;
  deleteToken: string;
}

// ─── Main form component ──────────────────────────────────────────────────────

export function ShelterSubmissionForm() {
  // Section 1 — Om shelteret
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  // Section 2 — Placering på kort
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Section 3 — Faciliteter
  const [facilities, setFacilities] = useState<Partial<Record<FacilityKey, boolean>>>({});

  // Section 4 — Billeder + kontakt
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Booking opt-in
  const [wantsBooking, setWantsBooking] = useState(false);
  const [bookingAccepted, setBookingAccepted] = useState(false);

  // ─── Photo upload ────────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = ""; // reset so same file can be re-selected

    if (!file) return;

    if (photos.length >= 5) {
      setPhotoError("Maks 5 billeder");
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/submit-shelter/photos", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.error ?? "Upload fejlede");
        return;
      }
      setPhotos((prev) => [
        ...prev,
        { path: data.path, previewUrl: data.previewUrl, deleteToken: data.deleteToken },
      ]);
    } catch {
      setPhotoError("Upload fejlede — prøv igen");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    // Fire-and-forget: clean up the orphaned upload from the bucket.
    fetch("/api/submit-shelter/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: photo.path, deleteToken: photo.deleteToken }),
    }).catch((err) => console.error("Photo delete failed:", err));
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Client-side validation
    if (!shelterName.trim()) {
      setSubmitError("Shelterets navn er påkrævet");
      return;
    }
    if (!locationText.trim()) {
      setSubmitError("Stedsbeskrivelse er påkrævet");
      return;
    }
    if (!contactEmail.trim()) {
      setSubmitError("Email er påkrævet");
      return;
    }
    if (bookingUrl.trim() && !/^https?:\/\//.test(bookingUrl.trim())) {
      setSubmitError("Booking-URL skal starte med http:// eller https://");
      return;
    }
    if (wantsBooking && !bookingAccepted) {
      setSubmitError("Du skal acceptere samarbejdsvilkårene for bookingsystemet");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner_registration",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          lat,
          lng,
          capacity: capacity ? Number(capacity) : undefined,
          description: description.trim() || undefined,
          facilities,
          booking_url: bookingUrl.trim() || undefined,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim(),
          photo_urls: photos.map((p) => p.path),
          wants_booking: wantsBooking,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Noget gik galt — prøv igen");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Netværksfejl — tjek din forbindelse og prøv igen");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-3xl mb-3">🏕️</div>
        <h2 className="text-xl font-semibold text-green-800 mb-2">Tak for din ansøgning!</h2>
        <p className="text-green-700 text-sm">
          Vi gennemgår dit shelter og vender tilbage til dig på{" "}
          <strong>{contactEmail}</strong>.
        </p>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Section 1: Om shelteret */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">1. Om shelteret</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Shelterens navn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shelterName}
              onChange={(e) => setShelterName(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx Skovhytten ved Esrum Sø"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Stedsbeskrivelse <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx Gribskov, tæt på Esrum Sø"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Kapacitet (antal personer)
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min={1}
              className="w-32 rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="fx 6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Beskrivelse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
              placeholder="Beskriv shelteret..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Booking-URL
            </label>
            <input
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      {/* Section 2: Placering på kort */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-2">2. Placering på kort</h2>
        <p className="text-sm text-primary/60 mb-3">Klik på kortet for at sætte en pin.</p>
        <div className="rounded-xl overflow-hidden border border-primary/10 mb-3">
          <SubmissionMapPicker
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </div>
        {lat != null && lng != null ? (
          <p className="text-xs text-primary/50">
            Koordinater: {lat.toFixed(5)}, {lng.toFixed(5)}
            <button
              type="button"
              onClick={() => {
                setLat(null);
                setLng(null);
              }}
              className="ml-2 text-red-400 hover:text-red-600 underline"
            >
              Fjern pin
            </button>
          </p>
        ) : (
          <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-700">
            Ingen pin sat — admin vil sætte koordinater ved gennemgang.
          </p>
        )}
      </section>

      {/* Section 3: Faciliteter */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-3">3. Faciliteter</h2>
        <div className="flex flex-wrap gap-3">
          {FACILITY_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={!!facilities[key]}
                onChange={(e) =>
                  setFacilities((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                className="rounded border-primary/30 accent-accent"
              />
              <span className="text-sm text-primary/80">{FACILITY_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Section 4: Billeder + kontakt */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">4. Billeder og kontakt</h2>
        <div className="space-y-4">
          {/* Photo upload */}
          <div>
            <p className="text-sm font-medium text-primary/80 mb-2">
              Billeder (valgfrit, maks 5 stk., JPEG/PNG, maks 5 MB pr. billede)
            </p>
            <div className="flex flex-wrap gap-3 mb-3">
              {photos.map((photo, i) => (
                <div key={photo.path} className="relative w-20 h-20">
                  {photo.previewUrl ? (
                    <img
                      src={photo.previewUrl}
                      alt={`Billede ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-primary/10"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs text-primary/40">
                      📷
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                    aria-label="Fjern billede"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:border-accent hover:text-accent transition-colors text-xs gap-1 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <span>...</span>
                  ) : (
                    <>
                      <span className="text-lg">+</span>
                      <span>Tilføj</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileSelect}
            />
            {photoError && (
              <p className="text-xs text-red-500 mt-1">{photoError}</p>
            )}
          </div>

          {/* Contact fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary/80 mb-1">
                Dit navn
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="Valgfrit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary/80 mb-1">
                Din email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="du@eksempel.dk"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Booking opt-in */}
      <section className="rounded-2xl border-2 border-accent/30 bg-accent/5 overflow-hidden">
        <label className="flex items-start gap-4 p-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wantsBooking}
            onChange={(e) => {
              setWantsBooking(e.target.checked);
              if (!e.target.checked) setBookingAccepted(false);
            }}
            className="mt-0.5 w-5 h-5 rounded border-accent/40 accent-[#C5A059] flex-shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <span className="font-bold text-primary text-sm">
                5. Aktiver digitalt bookingsystem
              </span>
              <span className="bg-accent text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                Anbefalet
              </span>
              <span className="text-xs text-accent font-semibold">Gratis</span>
            </div>
            <p className="text-sm text-primary/60">
              Lad gæsterne booke dit shelter direkte på ShelterDK — helt
              automatisk og uden administration for dig.
            </p>
          </div>
        </label>

        {wantsBooking && (
          <div className="border-t border-accent/20 px-5 pb-5 space-y-4">
            {/* Mini benefits */}
            <div className="grid sm:grid-cols-3 gap-3 pt-4">
              {[
                { icon: "🚫", label: "Ingen dobbeltbookinger" },
                { icon: "📩", label: "Automatiske bekræftelser" },
                { icon: "📊", label: "Fuldt overblik" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="bg-white rounded-xl p-3 text-center border border-accent/15"
                >
                  <div className="text-xl mb-1">{b.icon}</div>
                  <p className="text-xs font-semibold text-primary">{b.label}</p>
                </div>
              ))}
            </div>

            {/* Vilkår */}
            <div className="bg-white rounded-xl p-4 border border-primary/8">
              <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider mb-2">
                Samarbejdsvilkår
              </p>
              <div className="text-xs text-primary/50 leading-relaxed space-y-1.5 max-h-32 overflow-y-auto pr-1">
                <p>
                  <strong className="text-primary/70">Gratis for dig som ejer.</strong>{" "}
                  Ingen oprettelsespris, abonnement eller skjulte omkostninger.
                </p>
                <p>
                  <strong className="text-primary/70">Du bestemmer prisen.</strong>{" "}
                  Sæt selv en pris per nat og tjen penge på dit shelter — eller stil det gratis til rådighed. Det er helt op til dig.
                </p>
                <p>
                  <strong className="text-primary/70">Automatisk administration.</strong>{" "}
                  ShelterDK håndterer al betaling og kommunikation med gæsten.
                </p>
                <p>
                  <strong className="text-primary/70">Afmelding.</strong>{" "}
                  Begge parter kan til enhver tid opsige med 1 måneds varsel.
                </p>
                <p>
                  <strong className="text-primary/70">Servicegebyr.</strong>{" "}
                  For at dække drift og administration opkræves et servicegebyr på
                  20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er
                  ikke involveret i betalingstransaktionen.
                </p>
                <p>
                  <strong className="text-primary/70">Aflysninger.</strong>{" "}
                  Gæsten kan aflyse gratis op til 24 timer før. Aflyser du,
                  refunderes gæsten altid fuldt ud.
                </p>
                <p>
                  <strong className="text-primary/70">GDPR.</strong>{" "}
                  Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende
                  til administration af overnatningerne.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bookingAccepted}
                onChange={(e) => setBookingAccepted(e.target.checked)}
                className="mt-0.5 rounded border-primary/20 accent-[#C5A059]"
              />
              <span className="text-xs text-primary/60">
                Jeg accepterer{" "}
                <span className="underline text-primary/80 font-medium">
                  samarbejdsvilkårene
                </span>{" "}
                for bookingsystemet. Spørgsmål?{" "}
                <a
                  href="mailto:hej@shelterdk.dk"
                  className="underline hover:text-primary/60"
                >
                  hej@shelterdk.dk
                </a>
              </span>
            </label>
          </div>
        )}
      </section>

      {/* Error + Submit */}
      {submitError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-accent text-white py-3 font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {submitting ? "Sender..." : "Send ansøgning"}
      </button>
    </form>
  );
}
