"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, CheckCircle2 } from "lucide-react";
import type { SoegFilters } from "@/lib/soeg-db";

interface Props {
  open: boolean;
  onClose: () => void;
  region: string | null;
  q: string | null;
  area: string | null;
  filters: SoegFilters;
  /** Læsbar oversigt vist øverst — typisk "Bookbar i Jylland med toilet, vand". */
  summary: string;
  /**
   * Brugeren har et dato-/ledighedsfilter aktivt der IKKE gemmes i alerten
   * (alerts er om nye shelters generelt, ikke datospecifik ledighed). Vises
   * som en note så brugeren ikke bliver overrasket.
   */
  dateFilterDropped?: boolean;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; alreadyConfirmed: boolean }
  | { status: "error"; message: string };

export function SaveSearchModal({
  open,
  onClose,
  region,
  q,
  area,
  filters,
  summary,
  dateFilterDropped = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [accepted, setAccepted] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>("input[name='email']")?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  // Reset state ved hver åbning
  useEffect(() => {
    if (open) {
      setSubmit({ status: "idle" });
      setEmail("");
      setAccepted(false);
      setWebsite("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submit.status === "submitting") return;
    setSubmit({ status: "submitting" });
    try {
      const res = await fetch("/api/save-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, region, q, area, filters, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmit({ status: "error", message: data?.error ?? "Noget gik galt. Prøv igen." });
        return;
      }
      setSubmit({ status: "success", alreadyConfirmed: Boolean(data?.alreadyExists && data?.confirmed) });
    } catch {
      setSubmit({ status: "error", message: "Kunne ikke kontakte serveren. Prøv igen om lidt." });
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Gem søgning">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]"
        aria-label="Luk"
      />
      <div
        ref={dialogRef}
        className="absolute left-1/2 -translate-x-1/2 bottom-0 sm:top-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent/15 text-accent-dark">
              <Bell size={18} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-primary leading-tight">Gem søgning</h2>
              <p className="text-xs text-primary/55">Få besked når nye matches dukker op</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full text-primary/55 hover:text-primary hover:bg-primary/5"
            aria-label="Luk dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {submit.status === "success" ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 text-accent-dark mb-3">
                <CheckCircle2 size={26} />
              </div>
              {submit.alreadyConfirmed ? (
                <>
                  <h3 className="font-serif text-lg font-bold text-primary mb-2">Du er allerede tilmeldt</h3>
                  <p className="text-sm text-primary/70 leading-relaxed">
                    Vi har allerede en aktiv alert med samme kriterier for denne e-mail.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-lg font-bold text-primary mb-2">Tjek din indbakke</h3>
                  <p className="text-sm text-primary/70 leading-relaxed">
                    Vi har sendt en bekræftelsesmail til <strong>{email}</strong>. Klik linket for at aktivere din alert.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition-colors"
              >
                Luk
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl bg-primary/[0.03] border border-primary/10 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-primary/45 mb-0.5">
                  Din søgning
                </div>
                <p className="text-sm text-primary leading-snug font-medium">{summary}</p>
              </div>

              {dateFilterDropped && (
                <p className="text-xs leading-snug text-primary/65 px-1">
                  <strong>Bemærk:</strong> dit dato-/ledighedsfilter gemmes ikke i alerten.
                  Vi sender dig besked om <em>nye shelters</em> der matcher dine øvrige kriterier — ikke om ledighed på specifikke datoer.
                </p>
              )}

              <div>
                <label htmlFor="save-search-email" className="block text-xs font-semibold text-primary/60 mb-1">
                  Din e-mail
                </label>
                <input
                  id="save-search-email"
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dig@eksempel.dk"
                  className="w-full rounded-xl border border-primary/20 px-3 py-3 text-base text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              {/* Honeypot — usynlig for brugere, men bots udfylder den */}
              <div className="hidden" aria-hidden>
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              <label className="flex items-start gap-2 text-xs text-primary/65 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 rounded border-primary/30 text-accent-dark focus:ring-accent/40"
                />
                <span>
                  Jeg accepterer at modtage en bekræftelsesmail og periodiske alerts. Jeg kan altid afmelde via linket i mailen.
                </span>
              </label>

              {submit.status === "error" && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  Fejl: {submit.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submit.status === "submitting" || !accepted}
                className="w-full rounded-xl bg-accent-dark px-5 py-3 text-sm font-semibold text-white hover:bg-accent-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submit.status === "submitting" ? "Gemmer…" : "Gem søgning & få alerts"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
