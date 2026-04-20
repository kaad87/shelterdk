"use client";

import { useShelterTipModal } from "@/components/ShelterTipModalProvider";

export function MissingShelterBanner() {
  const { openModal } = useShelterTipModal();
  return (
    <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mt-4 mb-2">
      <p className="text-sm text-primary/70">
        <span className="font-medium text-primary">Mangler dit shelter?</span>{" "}
        Kender du et shelter der ikke er på ShelterDK?
      </p>
      <button
        onClick={openModal}
        className="flex-none text-sm font-semibold text-[#4a90d9] hover:text-[#3a7bc8] whitespace-nowrap transition-colors"
      >
        Fortæl os om det →
      </button>
    </div>
  );
}
