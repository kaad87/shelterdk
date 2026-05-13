"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "shelterdk-admin-secret";

type Severity = "info" | "warning" | "error" | "critical";
type StatusFilter = "open" | "acknowledged" | "resolved" | "all";

type EventRow = {
  id: string;
  created_at: string;
  severity: Severity;
  source: string;
  event_type: string;
  message: string;
  booking_id: string | null;
  payment_id: string | null;
  shelter_id: string | null;
  metadata: Record<string, unknown>;
  needs_attention: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

function badgeClass(severity: Severity) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "error":
      return "bg-orange-100 text-orange-700";
    case "warning":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

export default function AdminBookingMonitorPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : ""
  );
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const query = useMemo(
    () =>
      `/api/admin/booking-monitor?severity=${encodeURIComponent(severity)}&status=${encodeURIComponent(status)}&limit=200`,
    [severity, status]
  );

  useEffect(() => {
    if (!secret) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const headers = { "x-admin-secret": secret };

    async function load(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const r = await fetch(query, { headers });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401) throw new Error("401");
          throw new Error(typeof data.error === "string" ? data.error : "FETCH_FAILED");
        }
        if (cancelled) return;
        setEvents(data);
        setErrorMsg(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "401") setAuthError(true);
        else setErrorMsg(err instanceof Error ? err.message : "Kunne ikke hente monitor-hændelser lige nu.");
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [query, secret]);

  async function updateEvent(id: string, action: "acknowledge" | "resolve") {
    if (!secret) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/booking-monitor", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ id, action, actor: "admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Kunne ikke gemme");
      const headers = { "x-admin-secret": secret };
      const refreshedRes = await fetch(query, { headers });
      const refreshedData = await refreshedRes.json().catch(() => ({}));
      if (!refreshedRes.ok) {
        throw new Error(
          typeof refreshedData.error === "string" ? refreshedData.error : "Kunne ikke hente opdaterede hændelser"
        );
      }
      const refreshed = refreshedData as EventRow[];
      setEvents(refreshed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunne ikke opdatere hændelsen. Prøv igen.");
    } finally {
      setBusyId(null);
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-primary/60 text-sm">
            Log ind via <Link href="/admin" className="text-accent underline">admin-forsiden</Link> først.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <nav className="text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Booking monitor</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Booking monitor</h1>
          <p className="text-sm text-primary/60">
            Strukturerede hændelser fra booking-, betaling-, webhook- og cron-flowet.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              .writeText(JSON.stringify(events, null, 2))
              .catch((err) => {
                console.error("booking monitor copy failed:", err);
                setErrorMsg("Kunne ikke kopiere JSON fra monitoren.");
              })
          }
          className="rounded-lg border border-primary/15 bg-white px-4 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
        >
          Kopiér JSON
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border border-primary/10 bg-white p-4">
        <label className="text-sm text-primary/70">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "all")}
            className="mt-1 block rounded-lg border border-primary/15 px-3 py-2 text-sm"
          >
            <option value="all">Alle</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-sm text-primary/70">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="mt-1 block rounded-lg border border-primary/15 px-3 py-2 text-sm"
          >
            <option value="open">Åbne</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Løste</option>
            <option value="all">Alle</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Indlæser hændelser…
        </div>
      ) : (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
              Ingen hændelser i det valgte udsnit.
            </div>
          ) : (
            events.map((event) => (
              <article key={event.id} className="rounded-xl border border-primary/10 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(event.severity)}`}>
                        {event.severity.toUpperCase()}
                      </span>
                      {event.needs_attention && !event.acknowledged_at && !event.resolved_at && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          Kræver opmærksomhed
                        </span>
                      )}
                      <span className="text-xs text-primary/40">
                        {new Date(event.created_at).toLocaleString("da-DK")}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-primary">{event.message}</h2>
                    <p className="text-sm text-primary/60">
                      {event.source} · {event.event_type}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!event.acknowledged_at && (
                      <button
                        type="button"
                        disabled={busyId === event.id}
                        onClick={() => updateEvent(event.id, "acknowledge")}
                        className="rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    {!event.resolved_at && (
                      <button
                        type="button"
                        disabled={busyId === event.id}
                        onClick={() => updateEvent(event.id, "resolve")}
                        className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Markér som løst
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-primary/70 md:grid-cols-3">
                  <div>Booking: <span className="font-mono text-xs">{event.booking_id ?? "—"}</span></div>
                  <div>Payment: <span className="font-mono text-xs">{event.payment_id ?? "—"}</span></div>
                  <div>Shelter: <span className="font-mono text-xs">{event.shelter_id ?? "—"}</span></div>
                </div>

                {(event.acknowledged_at || event.resolved_at) && (
                  <div className="text-xs text-primary/50">
                    {event.acknowledged_at && `Acknowledged ${new Date(event.acknowledged_at).toLocaleString("da-DK")} af ${event.acknowledged_by ?? "admin"}`}
                    {event.acknowledged_at && event.resolved_at && " · "}
                    {event.resolved_at && `Løst ${new Date(event.resolved_at).toLocaleString("da-DK")} af ${event.resolved_by ?? "admin"}`}
                  </div>
                )}

                <details className="rounded-lg bg-primary/[0.03] p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Metadata</summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-primary/70">
                    {JSON.stringify(event.metadata ?? {}, null, 2)}
                  </pre>
                </details>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
