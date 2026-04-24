"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

interface BookingCalendarProps {
  unavailableDates: Record<string, "pending" | "confirmed" | "blocked">;
  onRangeSelect: (range: { checkIn: string; checkOut: string } | null) => void;
  maxPersons: number;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isUnavailable(
  date: Date,
  unavailable: Record<string, "pending" | "confirmed" | "blocked">
): boolean {
  const iso = toIso(date);
  return !!unavailable[iso];
}

export function BookingCalendar({
  unavailableDates,
  onRangeSelect,
}: BookingCalendarProps) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSelect = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to) {
      onRangeSelect({ checkIn: toIso(r.from), checkOut: toIso(r.to) });
    } else {
      onRangeSelect(null);
    }
  };

  const modifiers = {
    confirmed: (d: Date) => unavailableDates[toIso(d)] === "confirmed",
    pending: (d: Date) => unavailableDates[toIso(d)] === "pending",
    blocked: (d: Date) => unavailableDates[toIso(d)] === "blocked",
  };

  const modifiersStyles = {
    confirmed: { backgroundColor: "#fecaca", color: "#991b1b", borderRadius: "50%" },
    pending: { backgroundColor: "#fef08a", color: "#854d0e", borderRadius: "50%" },
    blocked: { backgroundColor: "#e5e7eb", color: "#9ca3af", borderRadius: "50%" },
  };

  return (
    <div>
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        disabled={(d) => d < today || isUnavailable(d, unavailableDates)}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        numberOfMonths={1}
      />
      <div className="flex gap-3 text-xs mt-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Ledig
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" /> Afventer
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Optaget
        </span>
      </div>
    </div>
  );
}
