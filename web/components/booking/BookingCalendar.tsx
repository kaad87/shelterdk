"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { da } from "react-day-picker/locale";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";
import { getNowInTimeZone, isPastSameDayDeadline } from "@/lib/booking-deadline";

interface BookingCalendarProps {
  unavailableDates: Record<string, "pending" | "confirmed" | "blocked">;
  onRangeSelect: (range: { checkIn: string; checkOut: string } | null) => void;
  maxPersons: number;
  /** TIME-streng fra DB (fx "17:00:00"). Null/undefined = ingen tidsfrist. */
  sameDayBookingDeadline?: string | null;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingCalendar({ unavailableDates, onRangeSelect, sameDayBookingDeadline }: BookingCalendarProps) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latestBookableDate = new Date(Date.now() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  latestBookableDate.setHours(0, 0, 0, 0);
  // Hvis ejeren har sat en tidsfrist og vi har passeret den i Europe/
  // Copenhagen tid, skal "i dag" disables som check-in. Vi bruger CPH-dato
  // (ikke browserens lokale) så klienten og /api/book er enige om hvilken
  // dag der tælles som "i dag" — vigtigt for gæster i andre tidszoner.
  const todayIsoCph = getNowInTimeZone(new Date()).date;
  const isTodayBlockedByDeadline = isPastSameDayDeadline(todayIsoCph, sameDayBookingDeadline ?? null);

  // When a check-in is selected but check-out isn't yet, find the first
  // unavailable night after the check-in so we can block everything from
  // that date onwards. This prevents the user from selecting a checkout that
  // "jumps over" a blocked night (which the backend would reject anyway).
  //
  // cutoff = firstBlockedNight + 1 day, because checkout ON the first blocked
  // night is valid (guest leaves that morning, not occupying the night). But
  // a checkout the following day would mean occupying the blocked night.
  const checkoutCutoff: Date | null = (() => {
    if (!range?.from || range?.to) return null;
    const start = range.from;
    const cur = new Date(start);
    cur.setDate(cur.getDate() + 1); // first potential checkout is start+1
    while (cur <= latestBookableDate) {
      const iso = toIso(cur);
      if (unavailableDates[iso]) {
        // cur is the first blocked night. Checkout ON cur is fine (guest leaves
        // that morning), but checkout the day after is not (would occupy cur).
        const cutoff = new Date(cur);
        cutoff.setDate(cutoff.getDate() + 1);
        return cutoff;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return null;
  })();

  const handleSelect = (r: DateRange | undefined) => {
    if (r?.from && r?.to) {
      // Prevent 0-night booking (same day for both check-in and check-out).
      if (toIso(r.from) === toIso(r.to)) {
        setRange({ from: r.from, to: undefined });
        onRangeSelect(null);
        return;
      }
      // Defensive: reject ranges that span a blocked night. Normally prevented
      // by the disabled function, but guard against edge cases in DayPicker.
      const cur = new Date(r.from);
      while (cur < r.to) {
        if (unavailableDates[toIso(cur)]) {
          setRange({ from: r.from, to: undefined });
          onRangeSelect(null);
          return;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
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
        toDate={latestBookableDate}
        disabled={(d) => {
          if (d < today) return true;
          const iso = toIso(d);
          // Tidsfrist for samme-dag-booking: hvis vi er efter ejerens deadline,
          // kan i dag ikke vælges som ny check-in. Eksisterende selection (hvor
          // i dag allerede er check-in) håndteres af phase-2-blokken nedenfor.
          if (isTodayBlockedByDeadline && iso === todayIsoCph && !range?.from) {
            return true;
          }

          // Phase 2: checkout-selection mode — check-in chosen, checkout not yet.
          if (range?.from && !range?.to) {
            // Disable all dates strictly before check-in (including blocked dates that
            // must not become re-selectable as a new start). Using strict < so the
            // check-in date itself stays visually anchored — DayPicker clears the
            // selection when range.from is disabled, which would break the UX.
            // 0-night is caught by handleSelect instead.
            if (d < range.from) return true;
            if (checkoutCutoff && d >= checkoutCutoff) return true;
            // The first blocked night (= cutoff − 1 day) intentionally stays open:
            // checkout ON that date is valid — guest departs that morning, not occupying
            // the night. Everything between check-in and cutoff is a valid checkout.
            return false;
          }

          // Phase 1 / 3: check-in selection or full range already chosen.
          // Don't re-disable currently selected endpoints (checkout may land on
          // a blocked night, which is valid and must remain un-disabled).
          if (range?.from && toIso(range.from) === iso) return false;
          if (range?.to && toIso(range.to) === iso) return false;
          return !!unavailableDates[iso];
        }}
        modifiers={{
          selectingStart: (d) =>
            !!range?.from &&
            !range?.to &&
            toIso(d) === toIso(range.from),
          confirmed: (d) => unavailableDates[toIso(d)] === "confirmed",
          pending: (d) => unavailableDates[toIso(d)] === "pending",
          blocked: (d) => unavailableDates[toIso(d)] === "blocked",
        }}
        modifiersClassNames={{
          selectingStart: "cal-selecting-start",
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
      <p className="mt-3 text-xs text-primary/35">
        Du kan booke op til {BOOKING_WINDOW_DAYS} dage frem.
      </p>

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
        .cal-selecting-start .cal-day-btn {
          background: rgba(197,160,89,0.14) !important;
          border: 1px solid rgba(197,160,89,0.55) !important;
          color: #8a6a26 !important;
          border-radius: 9999px !important;
          font-weight: 700;
          box-shadow: inset 0 0 0 1px rgba(197,160,89,0.1);
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
