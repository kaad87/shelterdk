"use client";

import { FACILITY_KEYS, FACILITY_LABELS } from "@/lib/shelter-submissions";
import type { FacilityKey } from "@/lib/shelter-submissions";

// Trin 3 — Faciliteter: valgfrie afkrydsningsfelter.

interface StepFacilitiesProps {
  facilities: Partial<Record<FacilityKey, boolean>>;
  setFacilities: (
    updater: (
      prev: Partial<Record<FacilityKey, boolean>>
    ) => Partial<Record<FacilityKey, boolean>>
  ) => void;
}

export function StepFacilities({ facilities, setFacilities }: StepFacilitiesProps) {
  return (
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
  );
}
