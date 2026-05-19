"use client";

import { useState, useEffect, useRef } from "react";
import type { ShelterBooking, BookingMessage } from "@/types/booking";
import PrintButton from "@/components/PrintButton";

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
  paymentHref?: string | null;
  paymentLabel?: string | null;
  amountPaidDkk?: number | null;
  paidAt?: string | null;
}

export function BookingPageClient({
  booking,
  shelterTitle,
  refundEligible,
  cancellationCutoffHours,
  guestToken,
  paymentHref,
  paymentLabel,
  amountPaidDkk = null,
  paidAt = null,
}: Props) {
  const [status, setStatus] = useState(booking.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Noget gik galt — prøv igen");
      }
      if (data.notice) {
        setCancelNotice(data.notice);
      } else if (data.wasPending) {
        setCancelNotice("Din forespørgsel er trukket tilbage, og datoerne er frigivet.");
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
  const bookingReference = `BK-${booking.id.slice(0, 8).toUpperCase()}`;
  const canShowProof = status === "confirmed";

  return (
    <div className="print-proof-screen">
      <div className="print-hide mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2C3E50] mb-1">Din booking</h1>
          <p className="text-gray-500">{shelterTitle}</p>
        </div>
        {canShowProof ? <PrintButton /> : null}
      </div>

      <div className="print-only mb-6 rounded-2xl border border-gray-300 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 mb-2">
          ShelterDK
        </p>
        <h1 className="text-2xl font-bold text-[#2C3E50] mb-2">Bookingbevis</h1>
        <p className="text-sm text-gray-600">{shelterTitle}</p>
      </div>

      {canShowProof && (
        <div className="print-card mb-6 rounded-2xl border border-green-200 bg-green-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700 mb-1">
                Bookingbevis
              </p>
              <h2 className="text-lg font-bold text-[#2C3E50]">
                Vis denne side eller din bekræftelsesmail ved ankomst
              </h2>
            </div>
            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Bekræftet
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProofItem label="Bookingreference" value={bookingReference} />
            <ProofItem label="Shelter" value={shelterTitle} />
            <ProofItem label="Ankomst" value={formatDate(booking.check_in)} />
            <ProofItem label="Afrejse" value={formatDate(booking.check_out)} />
            <ProofItem label="Antal personer" value={String(booking.guest_count)} />
            <ProofItem
              label="Betalingsstatus"
              value={amountPaidDkk != null ? `Betalt (${amountPaidDkk} kr)` : "Bekræftet"}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
            <span>Booking-ID: {booking.id}</span>
            <span>Oprettet: {new Date(booking.created_at).toLocaleString("da-DK")}</span>
            {paidAt ? <span>Betalt: {new Date(paidAt).toLocaleString("da-DK")}</span> : null}
          </div>
        </div>
      )}

      {/* Status badge */}
      <span
        className={`print-hide inline-block px-3 py-1 rounded-full text-sm font-medium mb-6 ${
          STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
        }`}
      >
        {STATUS_LABELS[status] ?? status}
      </span>

      {/* Booking details */}
      <div className="print-card bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-8">
        <Row label="Ankomst" value={formatDate(booking.check_in)} />
        <Row label="Afrejse" value={formatDate(booking.check_out)} />
        <Row label="Antal nætter" value={String(nights)} />
        <Row label="Antal personer" value={String(booking.guest_count)} />
        {booking.message && <Row label="Din besked" value={booking.message} />}
      </div>

      {canShowProof && (
        <div className="print-only mb-8 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700">
          Dette bookingbevis er udstedt af ShelterDK og kan vises ved ankomst som dokumentation
          for reservationen.
        </div>
      )}

      {(status === "pending" || status === "confirmed") && paymentHref && (
        <div className="print-hide mb-8 bg-[#fff8ee] border border-[#ead7b1] rounded-xl p-5">
          <h2 className="text-base font-semibold text-[#2C3E50] mb-2">Din booking mangler betaling</h2>
          <p className="text-sm text-gray-700 mb-4">
            {status === "confirmed"
              ? "Din plads er bekræftet, men betalingen er ikke færdig endnu. Du kan fortsætte her."
              : "Din betaling er ikke færdig endnu. Du kan fortsætte her og vende tilbage til Stripe."}
          </p>
          <a
            href={paymentHref}
            className="inline-block bg-[#c5a059] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#b8904a]"
          >
            {paymentLabel ?? "Gå til betaling"}
          </a>
        </div>
      )}

      {/* Message thread — only for pending/confirmed bookings */}
      {canMessage && (
        <div className="print-hide mb-8">
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

      {/* Cancel section — pending requests can also be withdrawn by the guest */}
      {(status === "pending" || status === "confirmed") && !showConfirm && (
        <div className="print-hide mt-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 transition-colors min-h-[44px]"
          >
            {status === "pending" ? "Træk forespørgsel tilbage" : "Annullér booking"}
          </button>
        </div>
      )}

      {(status === "pending" || status === "confirmed") && showConfirm && (
        <div className="print-hide mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="font-semibold text-red-700 mb-2">Er du sikker?</h2>
          {status === "pending" ? (
            <p className="text-sm text-gray-700 mb-4">
              Din forespørgsel bliver annulleret med det samme, og datoerne frigives til andre gæster.
            </p>
          ) : refundEligible ? (
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
              {loading
                ? "Annullerer…"
                : status === "pending"
                  ? "Ja, træk forespørgslen tilbage"
                  : "Ja, annullér booking"}
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
        <div className="print-hide mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
          {cancelNotice ? `${cancelNotice} ` : "Din booking er annulleret. "}
          <a href="/soeg" className="text-[#c5a059] underline">Find andre shelters</a>
        </div>
      )}

      <style jsx global>{`
        .print-only {
          display: none;
        }

        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          body {
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .print-proof-screen,
          .print-proof-screen * {
            visibility: visible;
          }

          .print-proof-screen {
            position: absolute;
            inset: 0;
            width: 100%;
            color: #1f2937;
          }

          .print-hide {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-card {
            border: 1px solid #d1d5db !important;
            background: white !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>
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

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-green-200/70 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-[#2C3E50] leading-relaxed">{value}</p>
    </div>
  );
}
