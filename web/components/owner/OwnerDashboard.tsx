"use client";

import { useState, useCallback, useEffect } from "react";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });
}

function fmtLong(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nights(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
}

// ─── types ───────────────────────────────────────────────────────────────────

type BlockedDateEntry = { date: string; source: "manual" | "ical_sync" };

interface PaymentInfo {
  booking_id: string;
  status: "pending" | "paid" | "failed" | "expired";
  amount_total_dkk: number;
  amount_shelter_dkk: number;
  amount_platform_dkk: number;
}

interface Props {
  shelter: BookableShelter;
  initialBookings: ShelterBooking[];
  initialBlockedDates: BlockedDateEntry[];
  ownerToken: string;
}

// ─── Mini calendar ───────────────────────────────────────────────────────────

interface CalEvent {
  checkIn: string;
  checkOut: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  label: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // Monday=0 ... Sunday=6
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

const DA_MONTHS = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December",
];
const DA_DAYS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

function DayCell({
  iso,
  events,
  blocked,
  blockedSync,
  isToday,
  isPast,
  onSelect,
  selected,
}: {
  iso: string;
  events: CalEvent[];
  blocked: boolean;
  blockedSync: boolean;
  isToday: boolean;
  isPast: boolean;
  onSelect: (iso: string) => void;
  selected: boolean;
}) {
  const confirmed = events.some((e) => e.status === "confirmed");
  const pending = events.some((e) => e.status === "pending");

  let dot: string | null = null;
  if (blockedSync) dot = "bg-primary/40";
  else if (blocked) dot = "bg-primary/20";
  else if (confirmed) dot = "bg-emerald-500";
  else if (pending) dot = "bg-amber-400";

  return (
    <button
      type="button"
      onClick={() => !isPast && onSelect(iso)}
      className={`relative flex flex-col items-center justify-start rounded-lg p-1 transition-colors text-xs leading-none
        ${isPast ? "opacity-30 cursor-default" : "hover:bg-primary/5 cursor-pointer"}
        ${selected ? "ring-2 ring-accent" : ""}
        ${isToday ? "font-bold text-accent" : "text-primary/70"}
        ${blocked && !isPast ? "bg-primary/[0.05]" : ""}
      `}
    >
      <span className="mb-1">{new Date(iso + "T12:00:00").getDate()}</span>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
    </button>
  );
}

function MiniCalendar({
  year,
  month,
  events,
  manualBlockedSet,
  syncedBlockedSet,
  onSelect,
  selectedDate,
}: {
  year: number;
  month: number;
  events: CalEvent[];
  manualBlockedSet: Set<string>;
  syncedBlockedSet: Set<string>;
  onSelect: (iso: string) => void;
  selectedDate: string | null;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayIso = today();

  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return isoFromDate(d);
    }),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-2 text-center">
        {DA_MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DA_DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-primary/30 py-1">
            {d}
          </div>
        ))}
        {cells.map((iso, i) =>
          iso === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <DayCell
              key={iso}
              iso={iso}
              events={events.filter((e) => iso >= e.checkIn && iso < e.checkOut)}
              blocked={manualBlockedSet.has(iso)}
              blockedSync={syncedBlockedSet.has(iso)}
              isToday={iso === todayIso}
              isPast={iso < todayIso}
              onSelect={onSelect}
              selected={iso === selectedDate}
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function OwnerDashboard({ shelter, initialBookings, initialBlockedDates, ownerToken }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [blockedDates, setBlockedDates] = useState<BlockedDateEntry[]>(initialBlockedDates);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockMsg, setBlockMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // iCal integration state
  const [icalImportUrl, setIcalImportUrl] = useState(shelter.ical_import_url ?? "");
  const [icalSavedUrl, setIcalSavedUrl] = useState(shelter.ical_import_url ?? "");
  const [icalLastSynced, setIcalLastSynced] = useState<string | null>(shelter.ical_last_synced_at ?? null);
  const [icalSaving, setIcalSaving] = useState(false);
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalMsg, setIcalMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [icalCopied, setIcalCopied] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Price settings state
  const [pricePerNight, setPricePerNight] = useState<string>(
    shelter.shelter_price_dkk != null ? String(shelter.shelter_price_dkk) : ""
  );
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceMsg, setPriceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayIso = today();
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.check_out > todayIso
  );
  const all = bookings.filter((b) => b.status !== "rejected" && b.status !== "cancelled");

  const calEvents: CalEvent[] = all.map((b) => ({
    checkIn: b.check_in,
    checkOut: b.check_out,
    status: b.status as "pending" | "confirmed",
    label: b.guest_name,
  }));

  const manualBlockedSet = new Set(blockedDates.filter((d) => d.source === "manual").map((d) => d.date));
  const syncedBlockedSet = new Set(blockedDates.filter((d) => d.source === "ical_sync").map((d) => d.date));

  // Events on selected date
  const selectedEvents = selectedDate
    ? calEvents.filter((e) => selectedDate >= e.checkIn && selectedDate < e.checkOut)
    : [];
  const selectedBlocked = selectedDate ? (manualBlockedSet.has(selectedDate) || syncedBlockedSet.has(selectedDate)) : false;
  const selectedBlockedSync = selectedDate ? syncedBlockedSet.has(selectedDate) : false;

  const isUpfront = shelter.payment_mode === "upfront";

  const embedCode = shelter.booking_mode === "iframe"
    ? `<iframe\n  src="https://shelterdk.dk/embed/book/${shelter.slug}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:8px;border:1px solid #e5e7eb;"\n  title="Book ${shelter.title}"\n></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;">\n  <a href="https://shelterdk.dk" target="_blank" rel="noopener" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a>\n</p>`
    : null;

  const bookingPageUrl = shelter.booking_mode === "shelterdk"
    ? `https://shelterdk.dk/book/${shelter.slug}`
    : `https://shelterdk.dk/embed/book/${shelter.slug}`;

  const icalExportUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/owner/${ownerToken}/calendar.ics`
    : `https://shelterdk.dk/api/owner/${ownerToken}/calendar.ics`;

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "lige nu";
    if (mins < 60) return `${mins} minut${mins !== 1 ? "ter" : ""} siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} time${hours !== 1 ? "r" : ""} siden`;
    return `${Math.floor(hours / 24)} dag${Math.floor(hours / 24) !== 1 ? "e" : ""} siden`;
  }

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/owner/${ownerToken}/payments`);
      if (res.ok) setPayments(await res.json());
    } catch {
      // silently fail
    }
  }, [ownerToken]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handlePriceSave = async () => {
    setPriceSaving(true);
    setPriceMsg(null);
    try {
      const price = pricePerNight === "" ? null : Number(pricePerNight);
      const res = await fetch(`/api/owner/${ownerToken}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shelter_price_dkk: price }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPriceMsg({ ok: false, text: data.error ?? "Fejl" });
      } else {
        setPriceMsg({ ok: true, text: "Pris gemt" });
      }
    } catch {
      setPriceMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setPriceSaving(false);
    }
  };

  const handleIcalSave = async () => {
    setIcalSaving(true);
    setIcalMsg(null);
    try {
      const res = await fetch(`/api/owner/${ownerToken}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_import_url: icalImportUrl || null }),
      });
      const data = await res.json();
      if (!res.ok || data.syncError) {
        setIcalMsg({ ok: false, text: data.syncError ?? data.error ?? "Fejl" });
      } else {
        setIcalSavedUrl(icalImportUrl);
        setIcalLastSynced(data.lastSynced);
        setIcalMsg({ ok: true, text: `Gemt og synket — ${data.blockedCount} datoer blokeret` });
      }
    } catch {
      setIcalMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setIcalSaving(false);
    }
  };

  const handleIcalSync = async () => {
    setIcalSyncing(true);
    setIcalMsg(null);
    try {
      const res = await fetch(`/api/owner/${ownerToken}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIcalMsg({ ok: false, text: data.error ?? "Synk fejlede" });
      } else {
        setIcalLastSynced(data.lastSynced);
        setIcalMsg({ ok: true, text: `Synkroniseret — ${data.blockedCount} datoer blokeret` });
      }
    } catch {
      setIcalMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setIcalSyncing(false);
    }
  };

  const handleAction = async (bookingId: string, action: "confirm" | "reject") => {
    setActionError(null);
    setActingId(bookingId);
    const res = await fetch(`/api/owner/${ownerToken}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action }),
    });
    const data = await res.json();
    setActingId(null);
    if (!res.ok) { setActionError(data.error ?? "Fejl"); return; }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: action === "confirm" ? "confirmed" : "rejected" }
          : b
      )
    );
    if (action === "confirm") fetchPayments();
  };

  const handleResendPayment = async (bookingId: string) => {
    setResendingId(bookingId);
    setActionError(null);
    const res = await fetch(`/api/owner/${ownerToken}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action: "resend-payment" }),
    });
    setResendingId(null);
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Fejl ved gensendelse");
    }
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg(null);
    setBlockLoading(true);
    const res = await fetch(`/api/owner/${ownerToken}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: blockFrom, to: blockTo || blockFrom }),
    });
    const data = await res.json();
    setBlockLoading(false);
    if (res.ok) {
      const days = data.blocked as number;
      setBlockMsg({ ok: true, text: days === 1 ? `Blokeret: ${blockFrom}` : `Blokeret ${days} dage (${blockFrom} → ${blockTo})` });
      // Update local blocked set
      const start = new Date(blockFrom + "T12:00:00");
      const end = new Date((blockTo || blockFrom) + "T12:00:00");
      const newDates: string[] = [];
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        newDates.push(isoFromDate(new Date(d)));
      }
      setBlockedDates((prev) => {
        const existing = new Set(prev.map((d) => d.date));
        const toAdd = newDates.filter((d) => !existing.has(d)).map((d) => ({ date: d, source: "manual" as const }));
        return [...prev, ...toAdd];
      });
      setBlockFrom("");
      setBlockTo("");
    } else {
      setBlockMsg({ ok: false, text: "Fejl — prøv igen" });
    }
  };

  const prevMonth = useCallback(() => {
    setSelectedDate(null);
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    setSelectedDate(null);
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }, [calMonth]);

  // Second month for two-month view
  const month2 = calMonth === 11 ? 0 : calMonth + 1;
  const year2 = calMonth === 11 ? calYear + 1 : calYear;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-primary/8 bg-white shadow-sm px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Ejer-dashboard</p>
            <h1 className="font-serif text-2xl font-bold text-primary leading-tight">{shelter.title}</h1>
            <p className="text-sm text-primary/45 mt-0.5">{shelter.owner_email}</p>
          </div>
          {/* Stats */}
          <div className="flex gap-3 flex-wrap">
            {pending.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-amber-700 leading-none">{pending.length}</p>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mt-0.5">Afventer</p>
              </div>
            )}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-center min-w-[80px]">
              <p className="text-2xl font-bold text-emerald-700 leading-none">{upcoming.length}</p>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mt-0.5">Kommende</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-2.5 text-center min-w-[80px]">
              <p className="text-2xl font-bold text-primary/70 leading-none">{shelter.max_persons}</p>
              <p className="text-[10px] font-semibold text-primary/40 uppercase tracking-wide mt-0.5">Maks pers.</p>
            </div>
          </div>
        </div>

        {/* Booking page link */}
        <div className="mt-4 flex items-center gap-2 pt-4 border-t border-primary/6">
          <span className="text-xs text-primary/35">
            {shelter.booking_mode === "shelterdk" ? "Bookingside" : "Embed-URL"}
          </span>
          <a
            href={bookingPageUrl}
            target="_blank"
            rel="noopener"
            className="text-xs text-accent hover:underline font-medium truncate"
          >
            {bookingPageUrl}
          </a>
        </div>
      </div>

      {/* ── Pending bookings ── */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-serif text-lg font-bold text-primary">Afventer svar</h2>
            <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5">
              {pending.length}
            </span>
          </div>
          {actionError && (
            <div className="mb-3 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
              {actionError}
            </div>
          )}
          <div className="space-y-3">
            {pending.map((b) => {
              const pendingPayment = payments.find((p) => p.booking_id === b.id);
              const hasPaidUpfront = isUpfront && pendingPayment?.status === "paid";
              return (
              <div key={b.id} className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden ${hasPaidUpfront ? "border-emerald-300" : "border-amber-200"}`}>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Date range */}
                    <div className={`hidden sm:grid grid-cols-2 divide-x rounded-xl border overflow-hidden shrink-0 ${hasPaidUpfront ? "divide-emerald-100 border-emerald-200 bg-emerald-50" : "divide-amber-100 border-amber-200 bg-amber-50"}`}>
                      <div className="px-3 py-2 text-center">
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${hasPaidUpfront ? "text-emerald-600" : "text-amber-600"}`}>Ankomst</p>
                        <p className="text-sm font-bold text-primary mt-0.5">{fmt(b.check_in)}</p>
                      </div>
                      <div className="px-3 py-2 text-center">
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${hasPaidUpfront ? "text-emerald-600" : "text-amber-600"}`}>Afrejse</p>
                        <p className="text-sm font-bold text-primary mt-0.5">{fmt(b.check_out)}</p>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-primary">{b.guest_name}</p>
                        <span className="text-xs text-primary/40">·</span>
                        <span className="text-xs text-primary/50">{b.guest_count} person{b.guest_count !== 1 ? "er" : ""}</span>
                        <span className="text-xs text-primary/40">·</span>
                        <span className="text-xs text-primary/50">{nights(b.check_in, b.check_out)} nætter</span>
                        {hasPaidUpfront && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                            ⚡ Forudbetalt {pendingPayment!.amount_total_dkk} kr
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-primary/50 mt-0.5">{b.guest_email}</p>
                      {/* Mobile dates */}
                      <p className="sm:hidden text-sm font-medium text-primary mt-1">
                        {fmt(b.check_in)} → {fmt(b.check_out)}
                      </p>
                      {b.message && (
                        <p className="mt-2 text-sm text-primary/65 italic bg-primary/[0.02] rounded-lg px-3 py-2 border border-primary/5">
                          &ldquo;{b.message}&rdquo;
                        </p>
                      )}
                      {hasPaidUpfront && (
                        <p className="mt-1.5 text-xs text-emerald-700 font-medium">
                          Gæsten har betalt forud — bekræft eller afvis (afvisning refunderer automatisk).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`flex border-t ${hasPaidUpfront ? "border-emerald-100" : "border-amber-100"}`}>
                  <button
                    onClick={() => handleAction(b.id, "confirm")}
                    disabled={actingId === b.id}
                    className="flex-1 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {actingId === b.id ? (
                      <span className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                    Acceptér
                  </button>
                  <div className="w-px bg-amber-100" />
                  <button
                    onClick={() => handleAction(b.id, "reject")}
                    disabled={actingId === b.id}
                    className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    {hasPaidUpfront ? "Afvis & refundér" : "Afvis"}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Calendar overview ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/6 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-primary">Kalender</h2>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3">
              {[
                { color: "bg-emerald-500", label: "Bekræftet" },
                { color: "bg-amber-400", label: "Afventer" },
                { color: "bg-primary/20", label: "Blokeret" },
                { color: "bg-primary/40", label: "Synket" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-xs text-primary/40">{label}</span>
                </div>
              ))}
            </div>
            {/* Nav */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/8 transition-colors text-primary/50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/8 transition-colors text-primary/50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Two-month grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            <MiniCalendar
              year={calYear}
              month={calMonth}
              events={calEvents}
              manualBlockedSet={manualBlockedSet}
              syncedBlockedSet={syncedBlockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
            <MiniCalendar
              year={year2}
              month={month2}
              events={calEvents}
              manualBlockedSet={manualBlockedSet}
              syncedBlockedSet={syncedBlockedSet}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
          </div>

          {/* Selected date detail */}
          {selectedDate && (selectedEvents.length > 0 || selectedBlocked) && (
            <div className="mt-4 pt-4 border-t border-primary/6">
              <p className="text-xs font-semibold text-primary/40 uppercase tracking-wide mb-2">{fmtLong(selectedDate)}</p>
              {selectedBlocked && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-sm text-primary/60 mb-2">
                  🔒 {selectedBlockedSync ? "Blokeret via kalendersynk" : "Manuelt blokeret dato"}
                </div>
              )}
              {selectedEvents.map((ev, i) => (
                <div key={i} className={`rounded-lg border px-3 py-2 text-sm mb-1.5 ${
                  ev.status === "confirmed"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  <span className="font-medium">{ev.label}</span>
                  <span className="text-xs opacity-70 ml-2">{fmt(ev.checkIn)} → {fmt(ev.checkOut)}</span>
                  <span className={`ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                    ev.status === "confirmed" ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    {ev.status === "confirmed" ? "Bekræftet" : "Afventer"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {selectedDate && selectedEvents.length === 0 && !selectedBlocked && (
            <div className="mt-4 pt-4 border-t border-primary/6">
              <p className="text-xs font-semibold text-primary/40 uppercase tracking-wide mb-1">{fmtLong(selectedDate)}</p>
              <p className="text-sm text-primary/35">Ingen booking eller blokering på denne dag</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Upcoming confirmed ── */}
      <section>
        <h2 className="font-serif text-lg font-bold text-primary mb-3">Kommende bekræftede bookinger</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/15 bg-primary/[0.02] px-6 py-8 text-center">
            <p className="text-sm text-primary/40">Ingen kommende bekræftede bookinger.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => {
              const payment = payments.find((p) => p.booking_id === b.id);
              return (
                <div key={b.id} className="rounded-xl border border-primary/8 bg-white shadow-sm px-4 py-3 flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 shrink-0">
                    <span className="text-xs font-bold text-emerald-700 leading-none">
                      {new Date(b.check_in + "T12:00:00").toLocaleDateString("da-DK", { day: "numeric" })}
                    </span>
                    <span className="text-[9px] text-emerald-600 uppercase leading-none mt-0.5">
                      {new Date(b.check_in + "T12:00:00").toLocaleDateString("da-DK", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm">{b.guest_name}</p>
                    <p className="text-xs text-primary/50">{fmt(b.check_in)} → {fmt(b.check_out)} · {b.guest_count} pers. · {nights(b.check_in, b.check_out)} nætter</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {payment?.status === "paid" && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        {isUpfront ? "Forudbetalt ✓" : "Betalt ✓"}
                      </span>
                    )}
                    {payment?.status === "pending" && (
                      <>
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                          Afventer betaling
                        </span>
                        <button
                          onClick={() => handleResendPayment(b.id)}
                          disabled={resendingId === b.id}
                          className="text-xs text-accent hover:text-accent/70 font-medium disabled:opacity-40 transition-colors"
                        >
                          {resendingId === b.id ? "Sender…" : "Gensend link"}
                        </button>
                      </>
                    )}
                    {payment?.status === "expired" && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                        Udløbet
                      </span>
                    )}
                    {!payment && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        Bekræftet
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Block dates ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
        <h2 className="font-serif text-lg font-bold text-primary mb-1">Bloker datoer</h2>
        <p className="text-xs text-primary/40 mb-4">Brug til egne ophold, vedligehold eller andre perioder shelteret ikke er tilgængeligt.</p>
        <form onSubmit={handleBlock} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Fra</label>
            <input
              type="date" required value={blockFrom}
              min={todayIso}
              onChange={(e) => {
                setBlockFrom(e.target.value);
                if (blockTo && blockTo < e.target.value) setBlockTo(e.target.value);
              }}
              className="rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Til</label>
            <input
              type="date" required value={blockTo || blockFrom}
              min={blockFrom || todayIso}
              onChange={(e) => setBlockTo(e.target.value)}
              className="rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={blockLoading || !blockFrom}
            className="rounded-xl bg-primary text-white px-5 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {blockLoading ? "Blokerer…" : "Bloker"}
          </button>
        </form>
        {blockMsg && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${blockMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
            {blockMsg.text}
          </div>
        )}
      </section>

      {/* ── Priser ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
        <h2 className="font-serif text-lg font-bold text-primary mb-1">Priser</h2>
        <p className="text-xs text-primary/40 mb-4">
          Angiv overnatningsprisen pr. nat. Gæsten betaler desuden et administrationsgebyr. Lad feltet være tomt for gratis ophold.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
              Pris pr. nat (kr)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={pricePerNight}
                onChange={(e) => setPricePerNight(e.target.value)}
                placeholder="0 = gratis"
                className="rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all w-36"
              />
              {pricePerNight !== "" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary/40 pointer-events-none">kr</span>
              )}
            </div>
          </div>
          <button
            onClick={handlePriceSave}
            disabled={priceSaving}
            className="rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {priceSaving ? "Gemmer…" : "Gem pris"}
          </button>
        </div>
        {priceMsg && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${priceMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
            {priceMsg.text}
          </div>
        )}
      </section>

      {/* ── Kalender-integration ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5 space-y-6">
        <h2 className="font-serif text-lg font-bold text-primary">Kalender-integration</h2>

        {/* Export */}
        <div>
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Din booking-kalender (.ics)</p>
          <p className="text-xs text-primary/40 mb-3">Abonnér én gang i Google Kalender, Apple Kalender eller ONE.com — nye bookinger synkroniserer automatisk.</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-primary/60 bg-primary/[0.03] border border-primary/10 rounded-lg px-3 py-2 flex-1 truncate">
              {icalExportUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(icalExportUrl); setIcalCopied(true); setTimeout(() => setIcalCopied(false), 1500); }}
              className="shrink-0 rounded-lg bg-white border border-primary/15 shadow-sm px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              {icalCopied ? "✓ Kopieret!" : "Kopiér URL"}
            </button>
          </div>
        </div>

        {/* Import */}
        <div>
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Synk fra ekstern kalender</p>
          <p className="text-xs text-primary/40 mb-3">
            Indsæt en iCal-URL fra ONE.com, Airbnb, Google Kalender el. lign. — ShelterDK blokerer automatisk de datoer der er optaget i din kalender.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={icalImportUrl}
              onChange={(e) => setIcalImportUrl(e.target.value)}
              placeholder="https://calendar.one.com/..."
              title="Datoer du fjerner fra din eksterne kalender genoppættes automatisk ved næste synk — fjern dem i din kalender, ikke her"
              className="flex-1 rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
            />
            <button
              onClick={handleIcalSave}
              disabled={icalSaving}
              className="shrink-0 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
            >
              {icalSaving ? "Gemmer…" : "Gem & synk"}
            </button>
          </div>

          {icalSavedUrl && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <p className="text-xs text-primary/40">
                Sidst synkroniseret: {icalLastSynced ? timeAgo(icalLastSynced) : "aldrig"}
              </p>
              <button
                onClick={handleIcalSync}
                disabled={icalSyncing}
                className="text-xs text-accent hover:text-accent/70 font-medium disabled:opacity-40 transition-colors"
              >
                {icalSyncing ? "Synker…" : "Synk nu"}
              </button>
            </div>
          )}

          {icalMsg && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${icalMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
              {icalMsg.text}
            </div>
          )}
        </div>
      </section>

      {/* ── Embed code — only for iframe mode ── */}
      {embedCode && (
        <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
          <h2 className="font-serif text-lg font-bold text-primary mb-1">Embed-kode til din hjemmeside</h2>
          <p className="text-xs text-primary/40 mb-4">Indsæt denne kode på din hjemmeside, hvor du vil have bookingkalenderen til at vises.</p>
          <div className="relative">
            <pre className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4 text-xs overflow-x-auto text-primary/70 whitespace-pre-wrap leading-relaxed">
              {embedCode}
            </pre>
            <button
              onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="absolute top-3 right-3 rounded-lg bg-white border border-primary/15 shadow-sm px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              {copied ? "✓ Kopieret!" : "Kopiér"}
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
