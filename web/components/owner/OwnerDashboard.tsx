"use client";

import { useState } from "react";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

const STATUS_LABELS: Record<string, string> = {
  pending: "Afventer",
  confirmed: "Bekræftet",
  rejected: "Afvist",
  cancelled: "Annulleret",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
  cancelled: "bg-gray-50 text-gray-600 border-gray-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  shelter: BookableShelter;
  initialBookings: ShelterBooking[];
  ownerToken: string;
}

export function OwnerDashboard({ shelter, initialBookings, ownerToken }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe\n  src="https://shelterdk.dk/embed/book/${shelter.slug}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:8px;border:1px solid #e5e7eb;"\n  title="Book ${shelter.title}"\n></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;">\n  <a href="https://shelterdk.dk" target="_blank" rel="noopener" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a>\n</p>`;

  const handleAction = async (bookingId: string, action: "confirm" | "reject") => {
    setActionError(null);
    const res = await fetch(`/api/owner/${ownerToken}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action }),
    });
    const data = await res.json();
    if (!res.ok) { setActionError(data.error ?? "Fejl"); return; }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: action === "confirm" ? "confirmed" : "rejected" }
          : b
      )
    );
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg(null);
    const res = await fetch(`/api/owner/${ownerToken}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: blockFrom, to: blockTo || blockFrom }),
    });
    const data = await res.json();
    if (res.ok) {
      const days = data.blocked as number;
      setBlockMsg(days === 1 ? `Blokeret: ${blockFrom}` : `Blokeret ${days} dage (${blockFrom} → ${blockTo})`);
      setBlockFrom("");
      setBlockTo("");
    } else {
      setBlockMsg("Fejl — prøv igen");
    }
  };

  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.check_in >= new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary mb-1">{shelter.title}</h1>
        <p className="text-primary/60 text-sm">Ejer-dashboard · {shelter.owner_email}</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Afventer svar ({pending.length})
          </h2>
          {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}
          <div className="space-y-3">
            {pending.map((b) => (
              <div key={b.id} className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-primary">{b.guest_name}</p>
                    <p className="text-sm text-primary/60">{b.guest_email} · {b.guest_count} pers.</p>
                    <p className="text-sm font-medium text-primary mt-1">
                      {formatDate(b.check_in)} → {formatDate(b.check_out)}
                    </p>
                    {b.message && <p className="text-sm text-primary/70 mt-1 italic">&ldquo;{b.message}&rdquo;</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(b.id, "confirm")}
                      className="rounded-lg bg-green-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-green-700 transition-colors"
                    >
                      Acceptér
                    </button>
                    <button
                      onClick={() => handleAction(b.id, "reject")}
                      className="rounded-lg border border-red-300 text-red-700 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 transition-colors"
                    >
                      Afvis
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming confirmed */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">
          Kommende bookinger ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-primary/50 text-sm">Ingen kommende bekræftede bookinger.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="rounded-xl border border-primary/10 bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">{b.guest_name}</p>
                  <p className="text-sm text-primary/60">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_count} pers.</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Block a date range */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">Bloker datoer</h2>
        <form onSubmit={handleBlock} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Fra</label>
            <input
              type="date" required value={blockFrom}
              onChange={(e) => {
                setBlockFrom(e.target.value);
                if (blockTo && blockTo < e.target.value) setBlockTo(e.target.value);
              }}
              className="rounded-lg border border-primary/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Til</label>
            <input
              type="date" required value={blockTo || blockFrom}
              min={blockFrom || undefined}
              onChange={(e) => setBlockTo(e.target.value)}
              className="rounded-lg border border-primary/20 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
            Bloker
          </button>
        </form>
        {blockMsg && <p className="text-sm text-primary/70 mt-2">{blockMsg}</p>}
      </section>

      {/* Embed code */}
      <section>
        <h2 className="font-serif text-xl font-bold text-primary mb-4">Embed-kode til din hjemmeside</h2>
        <div className="relative">
          <pre className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-xs overflow-x-auto text-primary/80 whitespace-pre-wrap">
            {embedCode}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute top-3 right-3 rounded-lg bg-white border border-primary/15 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            {copied ? "Kopieret!" : "Kopiér"}
          </button>
        </div>
      </section>
    </div>
  );
}
