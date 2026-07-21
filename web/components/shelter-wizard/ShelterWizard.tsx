"use client";

import { useState } from "react";
import type { FacilityKey } from "@/lib/shelter-submissions";
import { usePhotoUpload } from "./usePhotoUpload";
import { StepAbout } from "./steps/StepAbout";
import { StepMap } from "./steps/StepMap";
import { StepFacilities } from "./steps/StepFacilities";
import { StepPhotos } from "./steps/StepPhotos";
import { StepBooking } from "./steps/StepBooking";
import { StepReview } from "./steps/StepReview";

// ─── Trin-for-trin wizard til shelter-oprettelse ─────────────────────────────
// Samme felter, validering, backend og submit-payload som ShelterSubmissionForm
// — bare fordelt over 6 fokuserede trin med progress-bar.

const STEP_TITLES = [
  "Om shelteret",
  "Placering",
  "Faciliteter",
  "Billeder",
  "Booking",
  "Gennemse & send",
] as const;

const TOTAL_STEPS = STEP_TITLES.length;

export function ShelterWizard() {
  // Trin-navigation
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  // Trin 1 — Om shelteret
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  // Trin 2 — Placering på kort
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Trin 3 — Faciliteter
  const [facilities, setFacilities] = useState<Partial<Record<FacilityKey, boolean>>>({});

  // Honeypot (bruges også af foto-upload)
  const [website, setWebsite] = useState("");

  // Trin 4 — Billeder (via delt hook)
  const { photos, uploading, error: photoError, addPhoto, removePhoto } =
    usePhotoUpload(website);

  // Trin 5 — Booking opt-in
  const [wantsBooking, setWantsBooking] = useState(false);
  const [bookingAccepted, setBookingAccepted] = useState(false);

  // Trin 6 — Kontakt
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Submit-tilstand
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ─── Per-trin-validering ───────────────────────────────────────────────────
  // Samme regler/beskeder som ShelterSubmissionForm's handleSubmit, splittet ud.

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!shelterName.trim()) return "Shelterets navn er påkrævet";
      if (!locationText.trim()) return "Stedsbeskrivelse er påkrævet";
      if (bookingUrl.trim() && !/^https?:\/\//.test(bookingUrl.trim())) {
        return "Booking-URL skal starte med http:// eller https://";
      }
    }
    if (current === 4) {
      if (wantsBooking && !bookingAccepted) {
        return "Du skal acceptere samarbejdsvilkårene for bookingsystemet";
      }
    }
    if (current === 5) {
      if (!contactEmail.trim()) return "Email er påkrævet";
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  // ─── Submit (samme payload som ShelterSubmissionForm) ──────────────────────

  async function handleSubmit() {
    setSubmitError(null);
    const err = validateStep(5);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner_registration",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          website,
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

  // ─── Success-skærm ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="rounded-2xl border border-pine/20 bg-pine/5 p-8 text-center">
        <div className="text-3xl mb-3">🏕️</div>
        <h2 className="text-xl font-semibold text-pine mb-2">Tak for din ansøgning!</h2>
        <p className="text-primary/70 text-sm">
          Vi gennemgår dit shelter og vender tilbage til dig på{" "}
          <strong>{contactEmail}</strong>.
        </p>
      </div>
    );
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Progress-bar: 6 prikker med forbindelsesstreger */}
      <div className="flex items-center" aria-hidden="true">
        {STEP_TITLES.map((_, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors",
                  done
                    ? "bg-pine text-white"
                    : current
                    ? "bg-accent text-white ring-2 ring-accent/30"
                    : "bg-primary/10 text-primary/40",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div
                  className={[
                    "h-0.5 flex-1 mx-1 rounded transition-colors",
                    i < step ? "bg-pine" : "bg-primary/10",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Trin-titel */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary/40">
          Trin {step + 1} af {TOTAL_STEPS}
        </p>
        <h2 className="text-lg font-semibold text-primary">{STEP_TITLES[step]}</h2>
      </div>

      {/* Aktivt trin */}
      <div>
        {step === 0 && (
          <StepAbout
            shelterName={shelterName}
            setShelterName={setShelterName}
            locationText={locationText}
            setLocationText={setLocationText}
            capacity={capacity}
            setCapacity={setCapacity}
            description={description}
            setDescription={setDescription}
            bookingUrl={bookingUrl}
            setBookingUrl={setBookingUrl}
          />
        )}
        {step === 1 && (
          <StepMap lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
        )}
        {step === 2 && (
          <StepFacilities facilities={facilities} setFacilities={setFacilities} />
        )}
        {step === 3 && (
          <StepPhotos
            photos={photos}
            uploading={uploading}
            error={photoError}
            onAdd={addPhoto}
            onRemove={removePhoto}
          />
        )}
        {step === 4 && (
          <StepBooking
            wantsBooking={wantsBooking}
            setWantsBooking={setWantsBooking}
            bookingAccepted={bookingAccepted}
            setBookingAccepted={setBookingAccepted}
          />
        )}
        {step === 5 && (
          <StepReview
            shelterName={shelterName}
            locationText={locationText}
            capacity={capacity}
            description={description}
            bookingUrl={bookingUrl}
            facilities={facilities}
            lat={lat}
            lng={lng}
            photoCount={photos.length}
            wantsBooking={wantsBooking}
            contactName={contactName}
            setContactName={setContactName}
            contactEmail={contactEmail}
            setContactEmail={setContactEmail}
            website={website}
            setWebsite={setWebsite}
          />
        )}
      </div>

      {/* Fejlbesked (validering / submit) */}
      {(stepError || submitError) && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {stepError ?? submitError}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="rounded-xl border border-primary/20 px-5 py-3 font-semibold text-sm text-primary/70 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            Tilbage
          </button>
        ) : (
          <span />
        )}

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-accent-dark text-white px-6 py-3 font-semibold text-sm hover:bg-accent-dark/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Sender..." : "Send ansøgning"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-xl bg-pine text-white px-6 py-3 font-semibold text-sm hover:bg-pine-dark transition-colors"
          >
            Næste
          </button>
        )}
      </div>
    </div>
  );
}
