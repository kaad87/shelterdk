"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { da } from "react-day-picker/locale";

interface BookingCalendarProps {
  unavailableDates: Record<string, "pending" | "confirmed" | "blocked">;
  onRangeSelect: (range: { checkIn: string; checkOut: string } | null) => void;
  maxPersons: number;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  return (
    <div className="w-full">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        locale={da}
        disabled={(d) => {
          const iso = toIso(d);
          return d < today || !!unavailableDates[iso];
        }}
        modifiers={modifiers}
        modifiersClassNames={{
          confirmed: "rdp-day-confirmed",
          pending: "rdp-day-pending",
          blocked: "rdp-day-blocked",
        }}
        classNames={{
          root: "w-full",
          months: "w-full",
          month: "w-full",
          month_caption: "flex items-center justify-center relative mb-3 px-8",
          caption_label: "font-serif text-base font-semibold text-primary capitalize",
          nav: "absolute inset-x-0 top-0 flex justify-between pointer-events-none",
          button_previous:
            "pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/8 text-primary/50 hover:text-primary transition-colors",
          button_next:
            "pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/8 text-primary/50 hover:text-primary transition-colors",
          month_grid: "w-full border-collapse",
          weekdays: "mb-1",
          weekday:
            "text-center text-xs font-medium text-primary/40 uppercase tracking-wide pb-2 w-full",
          week: "",
          day: "p-0 text-center relative",
          day_button:
            "w-9 h-9 mx-auto flex items-center justify-center text-sm rounded-full transition-colors font-medium text-primary hover:bg-accent/15 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
          selected: "",
          today: "font-bold text-accent",
          outside: "opacity-25 pointer-events-none",
          disabled: "opacity-20 cursor-not-allowed line-through",
          range_start: "rdp-range-start",
          range_end: "rdp-range-end",
          range_middle: "rdp-range-middle",
          hidden: "invisible",
        }}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-primary/60">
          <span className="w-2.5 h-2.5 rounded-full bg-green-300 inline-block" />
          Ledig
        </span>
        <span className="flex items-center gap-1.5 text-xs text-primary/60">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 inline-block" />
          Afventer
        </span>
        <span className="flex items-center gap-1.5 text-xs text-primary/60">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />
          Optaget
        </span>
      </div>

      <style>{`
        /* Range highlight */
        .rdp-range-start .day_button,
        .rdp-range-end .day_button {
          background-color: #c5a059 !important;
          color: #fff !important;
          border-radius: 9999px !important;
        }
        .rdp-range-middle .day_button {
          background-color: rgba(197,160,89,0.15) !important;
          color: #2c3e50 !important;
          border-radius: 0 !important;
        }
        .rdp-range-start .day_button { border-radius: 9999px !important; }
        .rdp-range-end   .day_button { border-radius: 9999px !important; }

        /* Unavailable dots */
        .rdp-day-confirmed .day_button,
        .rdp-day-pending .day_button,
        .rdp-day-blocked .day_button {
          position: relative;
          pointer-events: none;
        }
        .rdp-day-confirmed .day_button::after,
        .rdp-day-pending  .day_button::after,
        .rdp-day-blocked  .day_button::after {
          content: '';
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
        }
        .rdp-day-confirmed .day_button { color: #991b1b !important; opacity: 0.7; }
        .rdp-day-confirmed .day_button::after { background: #f87171; }
        .rdp-day-pending   .day_button { color: #854d0e !important; opacity: 0.7; }
        .rdp-day-pending   .day_button::after { background: #facc15; }
        .rdp-day-blocked   .day_button { color: #9ca3af !important; opacity: 0.5; }
        .rdp-day-blocked   .day_button::after { background: #9ca3af; }
      `}</style>
    </div>
  );
}
