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

export function BookingCalendar({ unavailableDates, onRangeSelect }: BookingCalendarProps) {
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

  return (
    <div className="w-full">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        locale={da}
        disabled={(d) => d < today || !!unavailableDates[toIso(d)]}
        modifiers={{
          confirmed: (d) => unavailableDates[toIso(d)] === "confirmed",
          pending: (d) => unavailableDates[toIso(d)] === "pending",
          blocked: (d) => unavailableDates[toIso(d)] === "blocked",
        }}
        modifiersClassNames={{
          confirmed: "cal-confirmed",
          pending: "cal-pending",
          blocked: "cal-blocked",
        }}
        classNames={{
          root: "w-full select-none relative",
          months: "w-full",
          month: "w-full relative",
          month_caption: "flex items-center justify-center h-11 mb-2",
          caption_label: "font-serif text-[15px] font-bold text-primary capitalize tracking-wide",
          nav: "absolute top-0 inset-x-0 h-11 flex items-center justify-between z-10",
          button_previous:
            "w-11 h-11 flex items-center justify-center rounded-full text-primary/40 hover:text-primary hover:bg-primary/6 transition-all duration-150 active:scale-95",
          button_next:
            "w-11 h-11 flex items-center justify-center rounded-full text-primary/40 hover:text-primary hover:bg-primary/6 transition-all duration-150 active:scale-95",
          month_grid: "w-full table-fixed",
          weekdays: "mb-0.5",
          weekday:
            "text-center text-[11px] font-semibold text-primary/30 uppercase tracking-wider pb-2",
          week: "",
          day: "cal-day p-0 relative text-center",
          day_button:
            "cal-day-btn w-full h-11 flex items-center justify-center text-sm font-medium text-primary rounded-full hover:bg-primary/6 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 mx-auto",
          today: "cal-today",
          outside: "opacity-20 pointer-events-none",
          disabled: "cal-disabled",
          range_start: "cal-range-start",
          range_end: "cal-range-end",
          range_middle: "cal-range-mid",
          hidden: "invisible",
        }}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
        <span className="flex items-center gap-1.5 text-xs text-primary/50">
          <span className="w-2 h-2 rounded-full bg-green-300 inline-block" />
          Ledig
        </span>
        <span className="flex items-center gap-1.5 text-xs text-primary/50">
          <span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" />
          Afventer
        </span>
        <span className="flex items-center gap-1.5 text-xs text-primary/50">
          <span className="w-2 h-2 rounded-full bg-red-300 inline-block" />
          Optaget
        </span>
      </div>

      <style>{`
        /* Range: connected highlight across cells */
        .cal-range-mid .cal-day-btn {
          background: rgba(197,160,89,0.13) !important;
          border-radius: 0 !important;
          color: #2c3e50 !important;
        }
        .cal-range-start .cal-day-btn {
          background: #c5a059 !important;
          color: #fff !important;
          border-radius: 9999px !important;
        }
        .cal-range-end .cal-day-btn {
          background: #c5a059 !important;
          color: #fff !important;
          border-radius: 9999px !important;
        }
        /* Extend range background through the td */
        .cal-range-mid {
          background: rgba(197,160,89,0.13);
        }
        .cal-range-start {
          background: linear-gradient(to right, transparent 50%, rgba(197,160,89,0.13) 50%);
        }
        .cal-range-end {
          background: linear-gradient(to left, transparent 50%, rgba(197,160,89,0.13) 50%);
        }
        /* Today */
        .cal-today .cal-day-btn {
          font-weight: 700;
          color: #c5a059;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        /* Disabled */
        .cal-disabled .cal-day-btn {
          opacity: 0.22;
          cursor: not-allowed;
          text-decoration: line-through;
        }
        /* Unavailable state dots */
        .cal-confirmed .cal-day-btn,
        .cal-pending .cal-day-btn,
        .cal-blocked .cal-day-btn {
          position: relative;
          cursor: not-allowed;
        }
        .cal-confirmed .cal-day-btn { color: #991b1b !important; opacity: 0.55 !important; }
        .cal-pending   .cal-day-btn { color: #92400e !important; opacity: 0.65 !important; }
        .cal-blocked   .cal-day-btn { opacity: 0.25 !important; }
      `}</style>
    </div>
  );
}
