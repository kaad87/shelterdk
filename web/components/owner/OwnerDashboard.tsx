"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ShelterBooking, BookableShelter, BookingMessage } from "@/types/booking";

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

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
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
  apiBasePath: string;
  calendarExportUrl?: string;
  sharedSettingsPath?: string | null;
}

// ─── Mini calendar ───────────────────────────────────────────────────────────

interface CalEvent {
  checkIn: string;
  checkOut: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  label: string;
  source: ShelterBooking["source"];
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

// ─── BookingThreadPanel ───────────────────────────────────────────────────────

interface ThreadPanelProps {
  bookingId: string;
  messages: BookingMessage[] | null; // null = loading
  body: string;
  sending: boolean;
  error: string | null;
  bottomRef: React.RefObject<HTMLDivElement>;
  onBodyChange: (v: string) => void;
  onSend: () => void;
}

function BookingThreadPanel({
  messages,
  body,
  sending,
  error,
  bottomRef,
  onBodyChange,
  onSend,
}: ThreadPanelProps) {
  return (
    <div className="border-t border-primary/8 px-5 pt-4 pb-4 bg-gray-50/50">
      {/* Messages */}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-3 pr-1">
        {messages === null && (
          <p className="text-xs text-primary/40 text-center py-4">Henter beskeder…</p>
        )}
        {messages !== null && messages.length === 0 && (
          <p className="text-xs text-primary/40 text-center py-4">Ingen beskeder endnu.</p>
        )}
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.sender === "owner"
                ? "self-end bg-[#c5a059] text-white"
                : "self-start bg-white border border-gray-200 text-gray-800"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={`text-[10px] mt-1 ${m.sender === "owner" ? "text-yellow-100" : "text-gray-400"}`}>
              {m.sender === "guest" ? "Gæst · " : ""}
              {new Date(m.created_at).toLocaleString("da-DK", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
          }}
          placeholder="Skriv en besked til gæsten…"
          rows={2}
          maxLength={2000}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
        />
        <button
          onClick={onSend}
          disabled={sending || !body.trim()}
          className="shrink-0 bg-[#c5a059] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#b8904a] disabled:opacity-50 self-end"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

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
      onClick={() => onSelect(iso)}
      className={`relative flex flex-col items-center justify-start rounded-lg p-1 transition-colors text-xs leading-none
        ${isPast ? "opacity-60 cursor-pointer hover:bg-primary/5" : "hover:bg-primary/5 cursor-pointer"}
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

export function OwnerDashboard({
  shelter,
  initialBookings,
  initialBlockedDates,
  apiBasePath,
  calendarExportUrl,
  sharedSettingsPath = null,
}: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [blockedDates, setBlockedDates] = useState<BlockedDateEntry[]>(initialBlockedDates);
  const [actionError, setActionError] = useState<{ bookingId: string; text: string } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockMsg, setBlockMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualForm, setManualForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_count: "1",
    check_in: "",
    check_out: "",
    message: "",
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  const [resendMsg, setResendMsg] = useState<{ bookingId: string; text: string } | null>(null);

  // Messages (auto-beskeder) state
  interface MsgTemplates {
    confirmation_enabled: boolean;
    confirmation_subject: string;
    confirmation_body: string;
    reminder_enabled: boolean;
    reminder_subject: string;
    reminder_body: string;
  }
  const [msgTemplates, setMsgTemplates] = useState<MsgTemplates | null>(null);
  const [msgOriginal, setMsgOriginal] = useState<MsgTemplates | null>(null);
  const [msgSaving, setMsgSaving] = useState(false);
  const [msgSaved, setMsgSaved] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Refs for cursor-position tracking (placeholder chip insertion)
  const confSubjRef = useRef<HTMLInputElement>(null);
  const confBodyRef = useRef<HTMLTextAreaElement>(null);
  const remSubjRef = useRef<HTMLInputElement>(null);
  const remBodyRef = useRef<HTMLTextAreaElement>(null);
  type MsgField = "conf_subj" | "conf_body" | "rem_subj" | "rem_body";
  const [activeMsgField, setActiveMsgField] = useState<MsgField | null>(null);

  // confirmedWithEmail — tracks booking IDs that had auto-email sent this session
  const [confirmedWithEmail, setConfirmedWithEmail] = useState<Set<string>>(new Set());

  // Owner cancel state
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Cancellation policy state
  const [cutoffHours, setCutoffHours] = useState<string>(String(shelter.cancellation_cutoff_hours));
  const [cutoffSaving, setCutoffSaving] = useState(false);
  const [cutoffMsg, setCutoffMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ─── Booking messages (thread panel) ─────────────────────────────────────────
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, BookingMessage[]>>({});
  const [threadBody, setThreadBody] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayIso = today();
  const isUpfront = shelter.payment_mode === "upfront";

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
    source: b.source,
  }));

  const manualBlockedSet = new Set(blockedDates.filter((d) => d.source === "manual").map((d) => d.date));
  const syncedBlockedSet = new Set(blockedDates.filter((d) => d.source === "ical_sync").map((d) => d.date));

  // Events on selected date
  const selectedEvents = selectedDate
    ? calEvents.filter((e) => selectedDate >= e.checkIn && selectedDate < e.checkOut)
    : [];
  const selectedBlocked = selectedDate ? (manualBlockedSet.has(selectedDate) || syncedBlockedSet.has(selectedDate)) : false;
  const selectedBlockedSync = selectedDate ? syncedBlockedSet.has(selectedDate) : false;

  const embedCode = shelter.booking_mode === "iframe"
    ? `<iframe\n  src="https://shelterdk.dk/embed/book/${shelter.slug}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:8px;border:1px solid #e5e7eb;"\n  title="Book ${shelter.title}"\n></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;">\n  <a href="https://shelterdk.dk" target="_blank" rel="noopener" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a>\n</p>`
    : null;

  const bookingPageUrl = shelter.booking_mode === "shelterdk"
    ? `https://shelterdk.dk/book/${shelter.slug}`
    : `https://shelterdk.dk/embed/book/${shelter.slug}`;

  const resolvedIcalExportUrl = calendarExportUrl ?? (
    typeof window !== "undefined"
      ? `${window.location.origin}${apiBasePath}/calendar.ics`
      : `https://shelterdk.dk${apiBasePath}/calendar.ics`
  );
  const pendingLegendLabel = isUpfront ? "Afventer betaling" : "Afventer svar";

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "lige nu";
    if (mins < 60) return `${mins} minut${mins !== 1 ? "ter" : ""} siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} time${hours !== 1 ? "r" : ""} siden`;
    return `${Math.floor(hours / 24)} dag${Math.floor(hours / 24) !== 1 ? "e" : ""} siden`;
  }

  function previewMsg(template: string): string {
    const previewCheckIn = new Date();
    previewCheckIn.setDate(previewCheckIn.getDate() + 1);
    const previewCheckOut = new Date(previewCheckIn);
    previewCheckOut.setDate(previewCheckIn.getDate() + 2);
    const fmtDa = (d: Date) =>
      d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "long" });
    return template
      .replace(/{gæst_navn}/g, "Lars")
      .replace(/{shelter_navn}/g, shelter.title)
      .replace(/{ankomst_dato}/g, fmtDa(previewCheckIn))
      .replace(/{afrejse_dato}/g, fmtDa(previewCheckOut))
      .replace(/{antal_nætter}/g, "2")
      .replace(/{antal_personer}/g, "3");
  }

  const handleMsgSave = async () => {
    if (!msgTemplates) return;
    setMsgSaving(true);
    setMsgError(null);
    setMsgSaved(false);
    try {
      const res = await fetch(`${apiBasePath}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgTemplates),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgError(data.error ?? "Noget gik galt");
      } else {
        setMsgOriginal(msgTemplates);
        setMsgSaved(true);
        setTimeout(() => setMsgSaved(false), 3000);
      }
    } catch {
      setMsgError("Noget gik galt");
    } finally {
      setMsgSaving(false);
    }
  };

  const insertMsgPlaceholder = (placeholder: string) => {
    if (!activeMsgField || !msgTemplates) return;
    const refMap: Record<MsgField, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
      conf_subj: confSubjRef as React.RefObject<HTMLInputElement | null>,
      conf_body: confBodyRef as React.RefObject<HTMLTextAreaElement | null>,
      rem_subj: remSubjRef as React.RefObject<HTMLInputElement | null>,
      rem_body: remBodyRef as React.RefObject<HTMLTextAreaElement | null>,
    };
    const fieldMap: Record<MsgField, keyof MsgTemplates> = {
      conf_subj: "confirmation_subject",
      conf_body: "confirmation_body",
      rem_subj: "reminder_subject",
      rem_body: "reminder_body",
    };
    const el = refMap[activeMsgField].current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const field = fieldMap[activeMsgField];
    const current = String(msgTemplates[field]);
    const newValue = current.slice(0, start) + placeholder + current.slice(end);
    setMsgTemplates((prev) => (prev ? { ...prev, [field]: newValue } : null));
    // Restore focus and cursor position after React re-renders
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`${apiBasePath}/payments`);
      if (res.ok) setPayments(await res.json());
    } catch {
      // silently fail
    }
  }, [apiBasePath]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    fetch(`${apiBasePath}/messages`)
      .then((r) => r.json())
      .then((data: MsgTemplates) => {
        setMsgTemplates(data);
        setMsgOriginal(data);
      })
      .catch(() => {});
  }, [apiBasePath]);

  useEffect(() => {
    fetch(`${apiBasePath}/unread-counts`)
      .then((r) => r.json())
      .then((d) => setUnreadCounts(d.counts ?? {}))
      .catch(() => {});
  }, [apiBasePath]);

  useEffect(() => {
    if (openThreadId) {
      threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [openThreadId, threadMessages]);

  const openThread = useCallback(async (bookingId: string) => {
    if (openThreadId === bookingId) { setOpenThreadId(null); return; }
    setOpenThreadId(bookingId);
    setThreadBody("");
    setThreadError(null);
    try {
      const res = await fetch(`${apiBasePath}/booking/${bookingId}/messages`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke hente beskeder");
      }
      setThreadMessages((prev) => ({ ...prev, [bookingId]: data.messages ?? [] }));
      // Clear unread badge for this booking
      setUnreadCounts((prev) => { const next = { ...prev }; delete next[bookingId]; return next; });
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Kunne ikke hente beskeder");
    }
  }, [openThreadId, threadMessages, apiBasePath]);

  const sendOwnerMessage = useCallback(async (bookingId: string) => {
    if (!threadBody.trim()) return;
    setThreadSending(true);
    setThreadError(null);
    try {
      const res = await fetch(`${apiBasePath}/booking/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: threadBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Noget gik galt");
      setThreadMessages((prev) => ({
        ...prev,
        [bookingId]: [...(prev[bookingId] ?? []), data.message],
      }));
      setThreadBody("");
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setThreadSending(false);
    }
  }, [apiBasePath, threadBody]);

  const handleIcalSave = async () => {
    setIcalSaving(true);
    setIcalMsg(null);
    try {
      const res = await fetch(`${apiBasePath}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_import_url: icalImportUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIcalMsg({ ok: false, text: data.syncError ?? data.error ?? "Fejl" });
      } else if (data.syncError) {
        setIcalSavedUrl(icalImportUrl);
        setIcalLastSynced(data.lastSynced ?? null);
        setIcalMsg({ ok: false, text: `${data.syncError} URL'en er gemt, men synk fejlede.` });
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
      const res = await fetch(`${apiBasePath}/sync`, { method: "POST" });
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
    try {
      const res = await fetch(`${apiBasePath}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setActionError({ bookingId, text: data.error ?? "Fejl" }); return; }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: action === "confirm" ? "confirmed" : "rejected" }
            : b
        )
      );
      if (action === "confirm") fetchPayments();
      if (action === "confirm" && data.confirmationEmailSent) {
        setConfirmedWithEmail((prev) => new Set([...prev, bookingId]));
      }
    } catch {
      setActionError({ bookingId, text: "Noget gik galt" });
    } finally {
      setActingId(null);
    }
  };

  const handleResendPayment = async (bookingId: string) => {
    setResendingId(bookingId);
    setActionError(null);
    setResendMsg(null);
    try {
      const res = await fetch(`${apiBasePath}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action: "resend-payment" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError({ bookingId, text: data.error ?? "Fejl ved gensendelse" });
      } else {
        setResendMsg({ bookingId, text: "Betalingslink sendt igen" });
      }
    } catch {
      setActionError({ bookingId, text: "Noget gik galt ved gensendelse" });
    } finally {
      setResendingId(null);
    }
  };

  const handleOwnerCancel = async (bookingId: string) => {
    setCancelingId(bookingId);
    setCancelError(null);
    try {
      const res = await fetch(`${apiBasePath}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error ?? "Fejl"); return; }
      setBookings((prev) =>
        prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b)
      );
      setCancelConfirmId(null);
    } catch {
      setCancelError("Noget gik galt");
    } finally {
      setCancelingId(null);
    }
  };

  const handleCutoffSave = async () => {
    setCutoffSaving(true);
    setCutoffMsg(null);
    try {
      const hours = Number(cutoffHours);
      if (!Number.isInteger(hours) || hours < 0) {
        setCutoffMsg({ ok: false, text: "Ugyldig frist — angiv et helt tal ≥ 0" });
        return;
      }
      const res = await fetch(`${apiBasePath}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellation_cutoff_hours: hours }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCutoffMsg({ ok: false, text: data.error ?? "Fejl" });
      } else {
        setCutoffMsg({ ok: true, text: "Aflysningsfrist gemt" });
      }
    } catch {
      setCutoffMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setCutoffSaving(false);
    }
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg(null);
    setBlockLoading(true);
    const res = await fetch(`${apiBasePath}/block`, {
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
      setBlockMsg({ ok: false, text: data.error ?? "Fejl — prøv igen" });
    }
  };

  const handleManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualMsg(null);
    setManualSaving(true);
    try {
      const res = await fetch(`${apiBasePath}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          guest_count: Number(manualForm.guest_count),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManualMsg({ ok: false, text: data.error ?? "Kunne ikke oprette manuel booking" });
        return;
      }
      const booking = data.booking as ShelterBooking;
      setBookings((prev) =>
        [...prev, booking].sort((a, b) => a.check_in.localeCompare(b.check_in))
      );
      setManualForm({
        guest_name: "",
        guest_email: "",
        guest_count: "1",
        check_in: "",
        check_out: "",
        message: "",
      });
      setManualMsg({ ok: true, text: `Manuel booking oprettet for ${booking.guest_name}` });
    } catch {
      setManualMsg({ ok: false, text: "Noget gik galt — prøv igen" });
    } finally {
      setManualSaving(false);
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
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mt-0.5">{pendingLegendLabel}</p>
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
            <h2 className="font-serif text-lg font-bold text-primary">{pendingLegendLabel}</h2>
            <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">
            {pending.map((b) => {
              const showOwnerDecision = !isUpfront;
              return (
              <div key={b.id} className="rounded-2xl border-2 border-amber-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                    {/* Date range */}
                    <div className="grid grid-cols-2 divide-x divide-amber-100 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden w-full sm:w-auto sm:shrink-0">
                      <div className="px-3 py-2 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600">Ankomst</p>
                        <p className="text-sm font-bold text-primary mt-0.5">{fmt(b.check_in)}</p>
                      </div>
                      <div className="px-3 py-2 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600">Afrejse</p>
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
                      </div>
                      <p className="text-xs text-primary/50 mt-0.5">{b.guest_email}</p>
                      {b.message && (
                        <p className="mt-2 text-sm text-primary/65 italic bg-primary/[0.02] rounded-lg px-3 py-2 border border-primary/5">
                          &ldquo;{b.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-amber-100">
                  {showOwnerDecision ? (
                    <>
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
                        Afvis
                      </button>
                      <div className="w-px bg-amber-100" />
                    </>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <button
                    onClick={() => openThread(b.id)}
                    className="relative px-4 py-3 text-sm font-semibold text-primary/60 hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h10v8H8l-3 2V10H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                    Beskeder
                    {(unreadCounts[b.id] ?? 0) > 0 && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {unreadCounts[b.id]}
                      </span>
                    )}
                  </button>
                </div>
                {openThreadId === b.id && (
                  <BookingThreadPanel
                    bookingId={b.id}
                    messages={threadMessages[b.id] ?? null}
                    body={threadBody}
                    sending={threadSending}
                    error={threadError}
                    bottomRef={threadBottomRef}
                    onBodyChange={setThreadBody}
                    onSend={() => sendOwnerMessage(b.id)}
                  />
                )}
                {actionError?.bookingId === b.id && (
                  <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {actionError.text}
                  </div>
                )}
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
                { color: "bg-amber-400", label: pendingLegendLabel },
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
                    {ev.status === "confirmed" ? "Bekræftet" : pendingLegendLabel}
                  </span>
                  {ev.source === "owner_manual" && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70">
                      Manuel
                    </span>
                  )}
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
              const isManualBooking = b.source === "owner_manual";
              return (
                <div key={b.id} className="rounded-xl border border-primary/8 bg-white shadow-sm px-4 py-3">
                  <div className="flex items-center gap-4">
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
                    {isManualBooking && (
                      <span className="text-xs font-semibold text-primary/70 bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-full">
                        Manuel booking
                      </span>
                    )}
                    {payment?.status === "paid" && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        {isUpfront ? "Forudbetalt ✓" : "Betalt ✓"}
                      </span>
                    )}
                    {!isManualBooking && payment?.status === "pending" && (
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
                    {!isManualBooking && payment?.status === "expired" && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                        Udløbet
                      </span>
                    )}
                    {!payment && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        Bekræftet
                      </span>
                    )}
                    {confirmedWithEmail.has(b.id) && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                        ✓ Velkomstmail sendt
                      </span>
                    )}
                    {b.status === "confirmed" && cancelConfirmId !== b.id && (
                      <button
                        onClick={() => { setCancelConfirmId(b.id); setCancelError(null); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                      >
                        Annullér
                      </button>
                    )}
                    {!isManualBooking && (
                      <button
                        onClick={() => openThread(b.id)}
                        className="relative text-xs font-medium text-primary/50 hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2h10v8H8l-3 2V10H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                        Beskeder
                        {(unreadCounts[b.id] ?? 0) > 0 && (
                          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadCounts[b.id]}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  </div>{/* end inner flex row */}
                  {!isManualBooking && openThreadId === b.id && (
                    <BookingThreadPanel
                      bookingId={b.id}
                      messages={threadMessages[b.id] ?? null}
                      body={threadBody}
                      sending={threadSending}
                      error={threadError}
                      bottomRef={threadBottomRef}
                      onBodyChange={setThreadBody}
                      onSend={() => sendOwnerMessage(b.id)}
                    />
                  )}
                  {actionError?.bookingId === b.id && (
                    <div className="mt-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
                      {actionError.text}
                    </div>
                  )}
                  {cancelConfirmId === b.id && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 w-full">
                      <p className="text-xs text-red-700 font-medium mb-2">
                        Annullér booking for {b.guest_name}? Gæsten får besked og evt. refundering.
                      </p>
                      {cancelError && (
                        <p className="text-xs text-red-600 mb-2">{cancelError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOwnerCancel(b.id)}
                          disabled={cancelingId === b.id}
                          className="bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelingId === b.id ? "Annullerer…" : "Ja, annullér"}
                        </button>
                        <button
                          onClick={() => { setCancelConfirmId(null); setCancelError(null); }}
                          disabled={cancelingId === b.id}
                          className="text-xs text-gray-600 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Fortryd
                        </button>
                      </div>
                    </div>
                )}
                {resendMsg?.bookingId === b.id && (
                  <div className="mx-5 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700">
                    {resendMsg.text}
                  </div>
                )}
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

      {/* ── Manual bookings ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
        <h2 className="font-serif text-lg font-bold text-primary mb-1">Tilføj manuel booking</h2>
        <p className="text-xs text-primary/40 mb-4">
          Bruges til bookinger fra dit eget system, telefon eller email, så datoerne bliver optaget med det samme i ShelterDK.
        </p>
        <form onSubmit={handleManualBooking} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Navn *</label>
            <input
              required
              value={manualForm.guest_name}
              onChange={(e) => setManualForm((f) => ({ ...f, guest_name: e.target.value }))}
              className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
              placeholder="Navn på gæst"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={manualForm.guest_email}
              onChange={(e) => setManualForm((f) => ({ ...f, guest_email: e.target.value }))}
              className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
              placeholder="Valgfri"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Antal personer *</label>
            <input
              required
              type="number"
              min="1"
              max={shelter.max_persons}
              value={manualForm.guest_count}
              onChange={(e) => setManualForm((f) => ({ ...f, guest_count: e.target.value }))}
              className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
            />
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Ankomst *</label>
              <input
                required
                type="date"
                value={manualForm.check_in}
                onChange={(e) => {
                  const nextCheckIn = e.target.value;
                  setManualForm((f) => ({
                    ...f,
                    check_in: nextCheckIn,
                    check_out:
                      f.check_out && f.check_out > nextCheckIn
                        ? f.check_out
                        : nextCheckIn
                          ? addDaysIso(nextCheckIn, 1)
                          : f.check_out,
                  }));
                }}
                className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Afrejse *</label>
              <input
                required
                type="date"
                min={manualForm.check_in ? addDaysIso(manualForm.check_in, 1) : undefined}
                value={manualForm.check_out}
                onChange={(e) => setManualForm((f) => ({ ...f, check_out: e.target.value }))}
                className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Note</label>
            <textarea
              rows={3}
              maxLength={2000}
              value={manualForm.message}
              onChange={(e) => setManualForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-none"
              placeholder="Valgfri intern note om bookingen"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={manualSaving || !manualForm.check_in || !manualForm.check_out}
              className="rounded-xl bg-accent text-white px-5 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
            >
              {manualSaving ? "Opretter…" : "Opret manuel booking"}
            </button>
            <p className="text-xs text-primary/35">
              Bookingen oprettes direkte som bekræftet og sender ikke betalingslink eller beskedtråd.
            </p>
          </div>
        </form>
        {manualMsg && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${manualMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
            {manualMsg.text}
          </div>
        )}
      </section>

      {sharedSettingsPath && (
        <section className="rounded-2xl border border-accent/20 bg-accent/[0.03] shadow-sm px-5 py-5">
          <h2 className="font-serif text-lg font-bold text-primary mb-1">Fælles indstillinger</h2>
          <p className="text-sm text-primary/60">
            Beskrivelse, billeder, aflysningspolitik og automatiske beskeder styres for hele pladsen samlet.
          </p>
          <a
            href={sharedSettingsPath}
            className="mt-4 inline-flex rounded-xl border border-accent/30 bg-white px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5 transition-colors"
          >
            Gå til fælles indstillinger
          </a>
        </section>
      )}

      {!sharedSettingsPath && (
      <>
      {/* ── Aflysningspolitik ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5">
        <h2 className="font-serif text-lg font-bold text-primary mb-1">Aflysningspolitik</h2>
        <p className="text-xs text-primary/40 mb-4">
          Angiv antallet af timer før ankomst, inden for hvilken gæster ikke kan få refundering ved aflysning.
          Standard er 48 timer. Sæt til 0 for altid fuld refundering.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
              Frist (timer)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={cutoffHours}
                onChange={(e) => setCutoffHours(e.target.value)}
                placeholder="48"
                className="rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all w-36"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary/40 pointer-events-none">t</span>
            </div>
          </div>
          <button
            onClick={handleCutoffSave}
            disabled={cutoffSaving}
            className="rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {cutoffSaving ? "Gemmer…" : "Gem frist"}
          </button>
        </div>
        {cutoffMsg && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${cutoffMsg.ok ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
            {cutoffMsg.text}
          </div>
        )}
      </section>

      </>
      )}

      {/* ── Kalender-integration ── */}
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5 space-y-6">
        <h2 className="font-serif text-lg font-bold text-primary">Kalender-integration</h2>

        {/* Export */}
        <div>
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Din booking-kalender (.ics)</p>
          <p className="text-xs text-primary/40 mb-3">Abonnér én gang i Google Kalender, Apple Kalender eller ONE.com — nye bookinger synkroniserer automatisk.</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-primary/60 bg-primary/[0.03] border border-primary/10 rounded-lg px-3 py-2 flex-1 truncate">
              {resolvedIcalExportUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(resolvedIcalExportUrl); setIcalCopied(true); setTimeout(() => setIcalCopied(false), 1500); }}
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

      {/* ── Automatiske beskeder ── */}
      {!sharedSettingsPath && (
      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm px-5 py-5 space-y-6">
        <div>
          <h2 className="font-serif text-lg font-bold text-primary mb-0.5">Automatiske beskeder</h2>
          <p className="text-xs text-primary/40">
            Skriv personlige emails der sendes automatisk til gæster. Brug pladsholdere til at indsætte navne og datoer.
          </p>
        </div>

        {msgTemplates === null ? (
          <p className="text-sm text-primary/40">Henter…</p>
        ) : (
          <>
            {/* Placeholder chips */}
            {(() => {
              const PLACEHOLDERS = [
                { label: "{gæst_navn}", title: "Gæstens navn" },
                { label: "{shelter_navn}", title: "Shelterets navn" },
                { label: "{ankomst_dato}", title: "Ankomstdato" },
                { label: "{afrejse_dato}", title: "Afrejsedato" },
                { label: "{antal_nætter}", title: "Antal nætter" },
                { label: "{antal_personer}", title: "Antal personer" },
              ];
              return (
                <div>
                  <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-2">
                    Pladsholdere — klik for at indsætte ved cursoren
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        title={p.title}
                        onClick={() => insertMsgPlaceholder(p.label)}
                        className="rounded-lg border border-primary/15 bg-primary/[0.03] px-2.5 py-1 text-xs font-mono text-primary/70 hover:bg-accent/5 hover:border-accent/30 hover:text-accent transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Bekræftelsesbesked ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${msgTemplates.confirmation_enabled ? "border-primary/10 bg-white" : "border-primary/6 bg-primary/[0.02]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Bekræftelsesbesked</p>
                  <p className="text-xs text-primary/40">Sendes til gæsten når du bekræfter en booking</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={msgTemplates.confirmation_enabled}
                    onChange={(e) => {
                      setMsgTemplates((prev) =>
                        prev ? { ...prev, confirmation_enabled: e.target.checked } : null
                      );
                    }}
                  />
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${msgTemplates.confirmation_enabled ? "bg-accent" : "bg-primary/20"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${msgTemplates.confirmation_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs text-primary/50">{msgTemplates.confirmation_enabled ? "Til" : "Fra"}</span>
                </label>
              </div>

              {msgTemplates.confirmation_enabled ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Emne</label>
                    <input
                      ref={confSubjRef}
                      type="text"
                      value={msgTemplates.confirmation_subject}
                      maxLength={200}
                      onFocus={() => setActiveMsgField("conf_subj")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, confirmation_subject: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                      placeholder="Emne til bekræftelses-email"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.confirmation_subject.length}/200</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Besked</label>
                    <textarea
                      ref={confBodyRef}
                      value={msgTemplates.confirmation_body}
                      maxLength={2000}
                      rows={5}
                      onFocus={() => setActiveMsgField("conf_body")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, confirmation_body: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-y"
                      placeholder="Skriv din besked til gæsten…"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.confirmation_body.length}/2000</p>
                  </div>
                  {(msgTemplates.confirmation_subject || msgTemplates.confirmation_body) && (
                    <div>
                      <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Preview</p>
                      <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 space-y-1">
                        {msgTemplates.confirmation_subject && (
                          <p className="font-semibold text-primary text-xs">
                            {previewMsg(msgTemplates.confirmation_subject)}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary/70">
                          {previewMsg(msgTemplates.confirmation_body)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-primary/40 italic">Beskeden er slået fra — gæsten modtager ingen automatisk bekræftelsesmail.</p>
              )}
            </div>

            {/* ── Påmindelsesbesked ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${msgTemplates.reminder_enabled ? "border-primary/10 bg-white" : "border-primary/6 bg-primary/[0.02]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Påmindelsesbesked</p>
                  <p className="text-xs text-primary/40">Sendes automatisk dagen før gæstens ankomst</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={msgTemplates.reminder_enabled}
                    onChange={(e) => {
                      setMsgTemplates((prev) =>
                        prev ? { ...prev, reminder_enabled: e.target.checked } : null
                      );
                    }}
                  />
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${msgTemplates.reminder_enabled ? "bg-accent" : "bg-primary/20"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${msgTemplates.reminder_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs text-primary/50">{msgTemplates.reminder_enabled ? "Til" : "Fra"}</span>
                </label>
              </div>

              {msgTemplates.reminder_enabled ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Emne</label>
                    <input
                      ref={remSubjRef}
                      type="text"
                      value={msgTemplates.reminder_subject}
                      maxLength={200}
                      onFocus={() => setActiveMsgField("rem_subj")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, reminder_subject: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all"
                      placeholder="Emne til påmindelses-email"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.reminder_subject.length}/200</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Besked</label>
                    <textarea
                      ref={remBodyRef}
                      value={msgTemplates.reminder_body}
                      maxLength={2000}
                      rows={4}
                      onFocus={() => setActiveMsgField("rem_body")}
                      onChange={(e) =>
                        setMsgTemplates((prev) =>
                          prev ? { ...prev, reminder_body: e.target.value } : null
                        )
                      }
                      className="w-full rounded-xl border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40 transition-all resize-y"
                      placeholder="Skriv din påmindelsesbesked…"
                    />
                    <p className="mt-0.5 text-right text-[10px] text-primary/30">{msgTemplates.reminder_body.length}/2000</p>
                  </div>
                  {(msgTemplates.reminder_subject || msgTemplates.reminder_body) && (
                    <div>
                      <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">Preview</p>
                      <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 space-y-1">
                        {msgTemplates.reminder_subject && (
                          <p className="font-semibold text-primary text-xs">
                            {previewMsg(msgTemplates.reminder_subject)}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary/70">
                          {previewMsg(msgTemplates.reminder_body)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-primary/40 italic">Beskeden er slået fra — gæsten modtager ingen automatisk påmindelsesmail.</p>
              )}
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleMsgSave}
                disabled={
                  msgSaving ||
                  JSON.stringify(msgTemplates) === JSON.stringify(msgOriginal)
                }
                className="rounded-xl bg-accent text-white px-5 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
              >
                {msgSaving ? "Gemmer…" : "Gem beskeder"}
              </button>
              {msgSaved && (
                <span className="text-sm text-emerald-600 font-medium">✓ Beskeder gemt</span>
              )}
            </div>

            {msgError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
                {msgError}
              </div>
            )}
          </>
        )}
      </section>
      )}
    </div>
  );
}
