"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookingCalendar } from "./BookingCalendar";
import type { AvailabilityResponse } from "@/types/booking";

const SHELTER_DK_CVR = "37343080";

interface BookingFormProps {
  shelterSlug: string;
  shelterTitle: string;
  maxPersons: number;
  description?: string | null;
  showPageHeader?: boolean;
  hideTrustDetails?: boolean;
  successPath?: string;
  paymentMode?: "after_confirmation" | "upfront";
  shelterPriceDkk?: number;
  platformFeePct?: number;
  platformFeeMinDkk?: number;
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary/30" aria-hidden="true">
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
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary/25" aria-hidden="true">
      <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 1v4M12 1v4M2 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#c5a059" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function rangeConflictsWithAvailability(
  range: { checkIn: string; checkOut: string } | null,
  dates: Record<string, "pending" | "confirmed" | "blocked">
) {
  if (!range) return false;
  const cur = new Date(`${range.checkIn}T12:00:00`);
  const end = new Date(`${range.checkOut}T12:00:00`);
  while (cur < end) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
      cur.getDate()
    ).padStart(2, "0")}`;
    if (dates[iso]) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

function UpfrontTrustBlock() {
  return (
    <div className="rounded-xl border border-primary/10 bg-white px-4 py-3.5">
      <p className="text-xs font-semibold text-primary/70 mb-1.5">Om ShelterDK</p>
      <p className="text-xs text-primary/50 leading-relaxed mb-3">
        ShelterDK er en dansk platform til at finde og booke shelters i hele Danmark.
        Servicegebyret betales til ShelterDK og dækker administration af din booking.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>🏢</span>
          <span>CVR {SHELTER_DK_CVR}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>🔒</span>
          <span>Sikker online betaling</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>↩️</span>
          <span>Fuld refundering ved aflysning</span>
        </span>
      </div>
    </div>
  );
}

export function BookingForm({
  shelterSlug, shelterTitle, maxPersons, description, successPath,
  showPageHeader = true,
  hideTrustDetails = false,
  paymentMode = "after_confirmation", shelterPriceDkk = 0,
  platformFeePct = 5, platformFeeMinDkk = 25,
}: BookingFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, "pending" | "confirmed" | "blocked">>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [lastAvailabilityRefresh, setLastAvailabilityRefresh] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_count: 1, message: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const loadAvailability = useCallback(async (opts?: { silent?: boolean }) => {
    // Don't clobber dateRange via silent refresh while user is submitting.
    if (opts?.silent && submittingRef.current) return;
    if (!opts?.silent) {
      setLoadingAvailability(true);
    }
    setAvailabilityError(null);
    try {
      const res = await fetch(`/api/book/${shelterSlug}/availability?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Kunne ikke hente kalenderen");
      }
      const nextDates = (data as AvailabilityResponse).dates ?? {};
      setAvailability(nextDates);
      setLastAvailabilityRefresh(Date.now());
      setDateRange((currentRange) => {
        if (!rangeConflictsWithAvailability(currentRange, nextDates)) {
          return currentRange;
        }
        setError("De valgte datoer er blevet booket i mellemtiden. Vælg venligst nye datoer.");
        return null;
      });
    } catch {
      setAvailability({});
      setAvailabilityError("Kalenderen kunne ikke indlæses lige nu. Prøv igen, før du fortsætter.");
      setDateRange(null);
    } finally {
      if (!opts?.silent) {
        setLoadingAvailability(false);
      }
    }
  }, [shelterSlug]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        void loadAvailability({ silent: true });
      }
    };

    const handleFocusRefresh = () => {
      void loadAvailability({ silent: true });
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadAvailability({ silent: true });
      }
    }, 30000);

    document.addEventListener("visibilitychange", handleVisibleRefresh);
    window.addEventListener("focus", handleFocusRefresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
      window.removeEventListener("focus", handleFocusRefresh);
    };
  }, [loadAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // Guard against double-submit races
    if (!dateRange) { setError("Vælg ankomst- og afrejsedato"); return; }
    if (availabilityError) { setError("Kalenderen skal indlæses korrekt, før du kan booke"); return; }
    if (!acceptedTerms) { setError("Du skal acceptere bookingvilkårene og læse privatlivspolitikken"); return; }
    submittingRef.current = true;
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
          accepted_terms: acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        const target = successPath ?? `/book/${shelterSlug}/tak`;
        const params = new URLSearchParams();
        if (data.guestToken) params.set("guestToken", data.guestToken);
        router.push(params.size > 0 ? `${target}?${params.toString()}` : target);
      }
    } catch {
      setError("Noget gik galt. Tjek din forbindelse og prøv igen.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const nights = dateRange
    ? Math.round((new Date(dateRange.checkOut).getTime() - new Date(dateRange.checkIn).getTime()) / 86_400_000)
    : 0;

  const isUpfront = paymentMode === "upfront";
  const shelterTotalDkk = shelterPriceDkk * (nights || 1);
  const platformFee = Math.max(Math.round(shelterTotalDkk * platformFeePct / 100), platformFeeMinDkk);
  const totalDkk = shelterTotalDkk + platformFee;

  const trustSignals = ["Gratis at sende en forespørgsel", "Du betaler ingenting nu", "Ejer svarer typisk inden 24 timer"];

  return (
    <div className="w-full">
      {/* Page header */}
      {showPageHeader && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1.5">Booking</p>
          <h1 className="font-serif text-3xl font-bold text-primary leading-tight">{shelterTitle}</h1>
          {description && (
            <p className="mt-2 text-sm text-primary/55 leading-relaxed line-clamp-2">{description}</p>
          )}
        </div>
      )}

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
            ) : availabilityError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <p className="max-w-sm text-sm text-red-600">{availabilityError}</p>
                <button
                  type="button"
                  onClick={() => void loadAvailability()}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                >
                  Prøv igen
                </button>
              </div>
            ) : (
              <BookingCalendar
                unavailableDates={availability}
                onRangeSelect={(range) => {
                  setError(null);
                  setDateRange(range);
                  if (range) {
                    void loadAvailability({ silent: true });
                  }
                }}
                maxPersons={maxPersons}
              />
            )}
          </div>

          {!loadingAvailability && !availabilityError && lastAvailabilityRefresh ? (
            <p className="mt-3 text-[11px] text-primary/30">
              Kalenderen opdateres automatisk. Sidst opdateret{" "}
              {new Date(lastAvailabilityRefresh).toLocaleTimeString("da-DK", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          ) : null}

          {/* Trust signals – desktop only */}
          <div className="hidden md:block mt-5">
            {isUpfront ? (
              !hideTrustDetails ? <UpfrontTrustBlock /> : null
            ) : (
              !hideTrustDetails ? (
                <div className="flex flex-col gap-2">
                  {trustSignals.map((t) => (
                    <div key={t} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <CheckIcon />
                      </div>
                      <span className="text-xs text-primary/50">{t}</span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* ── RIGHT: Summary + Form ── */}
        <div className="md:sticky md:top-6 space-y-4">

          {/* Date summary card */}
          {dateRange ? (
            <div className="rounded-2xl border border-accent/25 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-accent/15">
                <div className="px-3 py-3">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-0.5">Ankomst</p>
                  <p className="text-sm font-bold text-primary leading-tight">{fmt(dateRange.checkIn)}</p>
                </div>
                <div className="px-3 py-3">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-0.5">Afrejse</p>
                  <p className="text-sm font-bold text-primary leading-tight">{fmt(dateRange.checkOut)}</p>
                </div>
              </div>
              <div className="border-t border-accent/10 px-4 py-2 bg-accent/[0.03] flex items-center justify-between">
                <span className="text-xs text-primary/45">Varighed</span>
                <span className="text-xs font-semibold text-primary">{nights} {nights === 1 ? "nat" : "nætter"}</span>
              </div>
              {isUpfront && (shelterTotalDkk > 0 || platformFee > 0) && (
                <div className="border-t border-accent/10 px-3 py-3 space-y-1.5">
                  {shelterTotalDkk > 0 && (
                    <div className="flex justify-between gap-2 text-xs text-primary/60">
                      <span className="min-w-0">Overnatning ({nights} {nights === 1 ? "nat" : "nætter"} × {shelterPriceDkk} kr)</span>
                      <span className="shrink-0 tabular-nums">{shelterTotalDkk} kr</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 text-xs text-primary/60">
                    <span>Administrationsgebyr inkl. moms</span>
                    <span className="shrink-0 tabular-nums">{platformFee} kr</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs font-bold text-primary border-t border-primary/10 pt-1.5">
                    <span>I alt</span>
                    <span className="shrink-0 tabular-nums">{totalDkk} kr</span>
                  </div>
                  <p className="text-[11px] text-primary/35 pt-1">Gebyret er vist inkl. 25 % moms.</p>
                </div>
              )}
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
                    className="w-11 h-11 flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 border-r border-primary/10"
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
                    className="w-11 h-11 flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 border-l border-primary/10"
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

              <label className="flex items-start gap-3 rounded-xl border border-primary/10 bg-primary/[0.02] px-4 py-3 text-sm text-primary/70">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-primary/30 text-accent focus:ring-accent"
                  required
                />
                <span className="leading-relaxed">
                  Jeg accepterer{" "}
                  <Link href="/vilkaar" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                    bookingvilkårene
                  </Link>{" "}
                  og har læst{" "}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                    privatlivspolitikken
                  </Link>
                  . Mine bookingoplysninger deles med shelter-ejeren for at administrere opholdet.
                </span>
              </label>

              {/* CTA */}
              <button
                type="submit"
                disabled={submitting || !dateRange || loadingAvailability || Boolean(availabilityError)}
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
                  isUpfront ? `Gå til betaling — ${totalDkk} kr` : "Send bookingforespørgsel"
                ) : (
                  "Vælg datoer for at fortsætte"
                )}
              </button>

              <p className="text-[11px] text-primary/30 text-center leading-relaxed">
                {isUpfront
                  ? "Du sendes videre til sikker betaling for at gennemføre bookingen."
                  : "Du modtager svar på mail, når shelter-ejeren har taget stilling til din forespørgsel."}
              </p>
            </form>
          </div>

          {/* Trust – mobile only */}
          <div className="md:hidden pt-1">
            {isUpfront ? (
              !hideTrustDetails ? <UpfrontTrustBlock /> : null
            ) : (
              !hideTrustDetails ? (
                <div className="flex flex-col gap-2">
                  {trustSignals.map((t) => (
                    <div key={t} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <CheckIcon />
                      </div>
                      <span className="text-xs text-primary/50">{t}</span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
