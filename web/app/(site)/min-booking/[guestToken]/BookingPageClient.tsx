"use client";

import { useState, useEffect, useRef } from "react";
import type { ShelterBooking, BookingMessage } from "@/types/booking";

const STATUS_LABELS: Record<string, string> = {
  pending: "Afventer bekræftelse",
  confirmed: "Bekræftet",
  rejected: "Afvist",
  cancelled: "Annulleret",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  booking: ShelterBooking;
  shelterTitle: string;
  refundEligible: boolean;
  cancellationCutoffHours: number;
  guestToken: string;
}

export function BookingPageClient({
  booking,
  shelterTitle,
  refundEligible,
  cancellationCutoffHours,
  guestToken,
}: Props) {
  const [status, setStatus] = useState(booking.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── Messaging ───────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canMessage = status === "pending" || status === "confirmed";

  useEffect(() => {
    if (!canMessage) return;
    fetch(`/api/booking/${guestToken}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {});
  }, [guestToken, canMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!msgBody.trim()) return;
    setMsgLoading(true);
    setMsgError(null);
    try {
      const res = await fetch(`/api/booking/${guestToken}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msgBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Noget gik galt");
      setMessages((prev) => [...prev, data.message]);
      setMsgBody("");
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setMsgLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${guestToken}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Noget gik galt — prøv igen");
      }
      setStatus("cancelled");
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setLoading(false);
    }
  }

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
        86_400_000
    )
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#2C3E50] mb-1">Din booking</h1>
      <p className="text-gray-500 mb-6">{shelterTitle}</p>

      {/* Status badge */}
      <span
        className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-6 ${
          STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
        }`}
      >
        {STATUS_LABELS[status] ?? status}
      </span>

      {/* Booking details */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-8">
        <Row label="Ankomst" value={formatDate(booking.check_in)} />
        <Row label="Afrejse" value={formatDate(booking.check_out)} />
        <Row label="Antal nætter" value={String(nights)} />
        <Row label="Antal personer" value={String(booking.guest_count)} />
        {booking.message && <Row label="Din besked" value={booking.message} />}
      </div>

      {/* Message thread — only for pending/confirmed bookings */}
      {canMessage && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-[#2C3E50] mb-3">Beskeder</h2>

          {/* Thread */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2 max-h-72 overflow-y-auto mb-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Ingen beskeder endnu. Skriv til ejeren herunder.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.sender === "guest"
                    ? "self-end bg-[#c5a059] text-white"
                    : "self-start bg-white border border-gray-200 text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    m.sender === "guest" ? "text-yellow-100" : "text-gray-400"
                  }`}
                >
                  {new Date(m.created_at).toLocaleString("da-DK", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Compose */}
          <div className="flex flex-col gap-2">
            <textarea
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Skriv en besked til ejeren…"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
            />
            {msgError && <p className="text-xs text-red-600">{msgError}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{msgBody.length}/2000</span>
              <button
                onClick={sendMessage}
                disabled={msgLoading || !msgBody.trim()}
                className="bg-[#c5a059] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#b8904a] disabled:opacity-50"
              >
                {msgLoading ? "Sender…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel section — only for confirmed bookings */}
      {status === "confirmed" && !showConfirm && (
        <div className="mt-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 transition-colors min-h-[44px]"
          >
            Annullér booking
          </button>
        </div>
      )}

      {status === "confirmed" && showConfirm && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="font-semibold text-red-700 mb-2">Er du sikker?</h2>
          {refundEligible ? (
            <p className="text-sm text-gray-700 mb-4">
              Du kan annullere og få fuld refundering, da der er mere end{" "}
              {cancellationCutoffHours} timer til ankomst.
            </p>
          ) : (
            <p className="text-sm text-gray-700 mb-4">
              Annullering inden for {cancellationCutoffHours} timer fra ankomst giver{" "}
              <strong>ikke refundering</strong>.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Annullerer…" : "Ja, annullér booking"}
            </button>
            <button
              onClick={() => { setShowConfirm(false); setError(null); }}
              disabled={loading}
              className="text-sm text-gray-600 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Fortryd
            </button>
          </div>
        </div>
      )}

      {status === "cancelled" && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
          Din booking er annulleret.{" "}
          <a href="/soeg" className="text-[#c5a059] underline">Find andre shelters</a>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-5 py-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-xs">{value}</span>
    </div>
  );
}
