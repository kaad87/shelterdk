"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { FACILITY_KEYS, FACILITY_LABELS, type FacilityKey } from "@/lib/shelter-submissions";

type FormState = "idle" | "loading" | "success" | "error";

export function RegistrerShelterForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  // Form fields
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [facilities, setFacilities] = useState<Partial<Record<FacilityKey, boolean>>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  const toggleFacility = (key: FacilityKey) => {
    setFacilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    setSubmittedEmail(contactEmail.trim());

    try {
      const cap = capacity ? parseInt(capacity, 10) : undefined;
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "owner_registration",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          capacity: cap && cap > 0 ? cap : null,
          description: description.trim() || undefined,
          facilities: Object.keys(facilities).length > 0 ? facilities : undefined,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim(),
          booking_url: bookingUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Noget gik galt. Prøv igen.");
        setState("error");
      }
    } catch {
      setErrorMsg("Netværksfejl. Tjek din forbindelse og prøv igen.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d0] p-10 text-center">
        <CheckCircle size={56} className="text-[#2d7a4e] mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-primary mb-2">
          Tak for din tilmelding!
        </h2>
        <p className="text-primary/70">
          Vi kontakter dig på <strong>{submittedEmail}</strong> inden shelteren publiceres, så du kan godkende indholdet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-[#e8e0d0] overflow-hidden"
    >
      {/* Section: Om shelteren */}
      <div className="px-6 py-5 border-b border-[#eee]">
        <h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">
          Om shelteren
        </h2>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Navn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shelterName}
              onChange={(e) => setShelterName(e.target.value)}
              placeholder="Shelterens fulde navn"
              required
              maxLength={200}
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
            />
          </div>

          {/* Address + Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Adresse <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Vejnavn og by"
                required
                maxLength={200}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Kapacitet
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Antal pladser"
                min={1}
                max={999}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Beskrivelse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort om stedet..."
              rows={3}
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40 resize-none"
            />
          </div>

          {/* Facilities */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">
              Faciliteter
            </label>
            <div className="flex flex-wrap gap-2">
              {FACILITY_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFacility(key)}
                  className={`text-sm px-3.5 py-1.5 rounded-full border-2 transition-all ${
                    facilities[key]
                      ? "border-[#2d7a4e] bg-[#f0faf4] text-[#2d7a4e] font-semibold"
                      : "border-primary/20 text-primary/70 hover:border-primary/40"
                  }`}
                >
                  {FACILITY_LABELS[key]}
                  {facilities[key] && " ✓"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Kontakt */}
      <div className="px-6 py-5">
        <h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">
          Dine kontaktoplysninger
        </h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Dit navn
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Navn"
                maxLength={100}
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-primary mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="til bekræftelse"
                required
                className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">
              Bookinglink
            </label>
            <input
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4e]/40"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-[#2d7a4e] text-white font-semibold py-3 rounded-xl hover:bg-[#236040] disabled:opacity-50 transition-colors"
        >
          {state === "loading" ? (
            <><Loader2 size={16} className="animate-spin" /> Sender...</>
          ) : (
            "Indsend til gennemgang"
          )}
        </button>
        <p className="mt-2 text-center text-xs text-primary/40">
          Vi kontakter dig på email inden shelteren publiceres
        </p>
      </div>
    </form>
  );
}
