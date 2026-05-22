"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Lightbulb, Loader2, CheckCircle } from "lucide-react";
import { useShelterTipModal } from "@/components/ShelterTipModalProvider";

type State = "idle" | "loading" | "success" | "error";

export function ShelterTipModal() {
  const { isOpen, closeModal } = useShelterTipModal();
  const [shelterName, setShelterName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [email, setEmail] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const titleId = "shelter-tip-modal-title";
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    closeModal();
    setShelterName("");
    setLocationText("");
    setEmail("");
    setSourceInfo("");
    setWebsite("");
    setState("idle");
    setErrorMsg("");
  }, [closeModal]);

  // ESC key + body scroll lock + focus trap while modal is open
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstElement = () => {
      const target = firstInputRef.current ?? closeButtonRef.current;
      target?.focus();
    };
    const rafId = window.requestAnimationFrame(focusFirstElement);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modalRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelterName.trim() || !locationText.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/submit-shelter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_tip",
          shelter_name: shelterName.trim(),
          location_text: locationText.trim(),
          contact_email: email.trim() || undefined,
          website,
          source_info: sourceInfo.trim() || undefined,
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

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#4a90d9] text-white px-5 py-4 rounded-t-2xl">
          <Lightbulb size={20} />
          <h2 id={titleId} className="font-semibold">Tip om manglende shelter</h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="ml-auto inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Luk"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={48} className="text-green-500" />
              <p className="font-semibold text-primary text-lg">Tak — vi kigger på det!</p>
              <p className="text-sm text-primary/60">Dit tip er registreret og behandles inden for få dage.</p>
                <button
                  onClick={handleClose}
                  className="mt-2 bg-[#4a90d9] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#3a7bc8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/50 focus-visible:ring-offset-2"
                >
                Luk
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-primary/70 bg-blue-50 rounded-lg px-3 py-2.5">
                Kender du et shelter der ikke findes på ShelterDK? Fortæl os om det — vi kigger på det.
              </p>

              {/* Shelter name */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Shelterens navn <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={shelterName}
                  onChange={(e) => setShelterName(e.target.value)}
                  placeholder='Fx "Shelter ved Silkeborg Sø"'
                  required
                  maxLength={200}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/40 focus-visible:border-[#4a90d9]"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Placering <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Adresse, by eller postnr"
                  required
                  maxLength={200}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/40 focus-visible:border-[#4a90d9]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Din e-mail{" "}
                  <span className="font-normal text-primary/50">(valgfrit)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Fx navn@email.dk"
                  maxLength={200}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/40 focus-visible:border-[#4a90d9]"
                />
              </div>

              {/* Extra info */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                  Hvad ved du om shelteren?{" "}
                  <span className="font-normal text-primary/50">(valgfrit)</span>
                </label>
                <textarea
                  value={sourceInfo}
                  onChange={(e) => setSourceInfo(e.target.value)}
                  placeholder="Fx hvem der ejer den, link til kommunens hjemmeside..."
                  maxLength={500}
                  rows={3}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/40 focus-visible:border-[#4a90d9] resize-none"
                />
                <div className="text-right text-xs text-primary/40 mt-0.5">
                  {sourceInfo.length}/500
                </div>
              </div>

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

              {errorMsg && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-1">
                <button
                  type="submit"
                  disabled={state === "loading" || !shelterName.trim() || !locationText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4a90d9] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[#3a7bc8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/50 focus-visible:ring-offset-2"
                >
                  {state === "loading" ? (
                    <><Loader2 size={15} className="animate-spin" /> Sender...</>
                  ) : (
                    "Send tip"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="border border-primary/20 text-primary/80 font-medium px-4 py-2.5 rounded-xl hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/40 focus-visible:ring-offset-2"
                >
                  Annuller
                </button>
              </div>

              <p className="text-center text-xs text-primary/40">
                Ingen konto krævet · behandles inden for få dage
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
