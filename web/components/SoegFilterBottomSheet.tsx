"use client";

import { useEffect, useRef } from "react";
import { X, Users } from "lucide-react";
import type { SoegFilters } from "@/lib/soeg-db";
import { FILTER_OPTIONS } from "@/lib/soeg-filter-options";

interface Props {
  open: boolean;
  filters: SoegFilters;
  onToggle: (key: keyof SoegFilters) => void;
  onSetMinPladser: (value: number | undefined) => void;
  onClearAll: () => void;
  onClose: () => void;
}

/**
 * Bottom-sheet til mobile filter-valg.
 * Vises kun på mobil (`md:hidden` i forælder); desktop bruger den
 * fulde chip-række.
 */
export function SoegFilterBottomSheet({
  open,
  filters,
  onToggle,
  onSetMinPladser,
  onClearAll,
  onClose,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // ESC + body scroll lock når sheeten er åben
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    // Focus første knap når sheeten åbnes
    setTimeout(() => {
      sheetRef.current?.querySelector<HTMLButtonElement>("button[data-first-focus]")?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const facilityFilters = FILTER_OPTIONS.filter((f) => f.group === "faciliteter");
  const qualityFilters = FILTER_OPTIONS.filter((f) => f.group === "kvalitet");

  const activeCount =
    FILTER_OPTIONS.filter(({ key }) => filters[key]).length +
    (filters.min_pladser && filters.min_pladser > 0 ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-[60] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filtrer shelters"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-primary/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Luk filterpanel"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overscroll-contain animate-[slideUp_220ms_ease-out]"
      >
        {/* Handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-primary/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-primary/10">
          <h2 className="font-serif text-lg font-bold text-primary">Filtrer</h2>
          <button
            type="button"
            onClick={onClose}
            data-first-focus
            className="p-1.5 -mr-1.5 rounded-full text-primary/60 hover:text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Luk filterpanel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Min. pladser */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-primary/45 mb-2">
              Hvor mange er I?
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.02] px-4 py-3">
              <Users size={18} className="text-primary/50 shrink-0" />
              <label htmlFor="filter-min-pladser-mobile" className="text-sm text-primary flex-1">
                Min. antal pladser
              </label>
              <input
                id="filter-min-pladser-mobile"
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                placeholder="–"
                value={filters.min_pladser ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  onSetMinPladser(v > 0 ? v : undefined);
                }}
                className="w-14 bg-white rounded-lg border border-primary/15 px-2 py-1.5 text-center text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-accent/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </section>

          {/* Faciliteter */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-primary/45 mb-2">
              Faciliteter
            </h3>
            <div className="flex flex-wrap gap-2">
              {facilityFilters.map(({ key, label, icon }) => {
                const active = Boolean(filters[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggle(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all touch-manipulation min-h-[40px] ${
                      active
                        ? "bg-primary/10 text-primary border-primary/40"
                        : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
                    aria-pressed={active}
                  >
                    <span className={active ? "text-primary" : "text-primary/50"}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Kvalitet */}
          {qualityFilters.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-primary/45 mb-2">
                Kvalitet
              </h3>
              <div className="flex flex-wrap gap-2">
                {qualityFilters.map(({ key, label, icon }) => {
                  const active = Boolean(filters[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onToggle(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all touch-manipulation min-h-[40px] ${
                        active
                          ? "bg-primary/10 text-primary border-primary/40"
                          : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
                      aria-pressed={active}
                    >
                      <span className={active ? "text-primary" : "text-primary/50"}>{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-primary/10 bg-white">
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="flex-1 rounded-xl border border-primary/15 px-4 py-3 text-sm font-medium text-primary/70 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ryd
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-[2] rounded-xl bg-accent-dark px-4 py-3 text-sm font-semibold text-white hover:bg-accent-dark/90 transition-colors"
          >
            Vis resultater{activeCount > 0 ? ` (${activeCount} aktive)` : ""}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
