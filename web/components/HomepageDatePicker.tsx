"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

export function HomepageDatePicker({ className = "" }: { className?: string }) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      router.push(`/soeg?date=${val}`);
    }
  }

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors ${className}`}
      title="Søg ledige shelters på en bestemt dato"
    >
      <CalendarDays size={14} aria-hidden className="shrink-0" />
      <span className="whitespace-nowrap">Søg dato</span>
      {/* suppressHydrationWarning: min is computed client-side and differs from SSR — that's intentional */}
      <input
        type="date"
        onChange={handleChange}
        suppressHydrationWarning
        min={(() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })()}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Vælg dato for ledighedssøgning"
      />
    </label>
  );
}
