"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShelterBookingProvider } from "@/types/shelter";
import type {
  BookingCandidate,
  BookingCandidateReviewStatus,
} from "@/lib/booking-candidates";

type ReviewStatusFilter = BookingCandidateReviewStatus | "pending" | "all";

interface BookingCandidateApiResponse {
  items: BookingCandidate[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: {
    total: number;
    pending: number;
    booking_found: number;
    contact_only: number;
    not_bookable: number;
    needs_manual: number;
  };
}

interface BookingCandidateReviewQueueProps {
  secret: string;
}

const STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: "pending", label: "Ikke gennemgået" },
  { value: "all", label: "Alle" },
  { value: "booking_found", label: "Booking fundet" },
  { value: "contact_only", label: "Kontakt / manuel booking" },
  { value: "needs_manual", label: "Kræver research" },
  { value: "not_bookable", label: "Ikke bookbar" },
];

const PROVIDER_OPTIONS: Array<{ value: ShelterBookingProvider; label: string }> = [
  { value: "private", label: "Privat" },
  { value: "kommune", label: "Kommune" },
  { value: "naturstyrelsen", label: "Naturstyrelsen" },
  { value: "udinaturen", label: "Udinaturen" },
  { value: "unknown", label: "Ukendt" },
];

function statusBadge(status: BookingCandidateReviewStatus | null) {
  switch (status) {
    case "booking_found":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "contact_only":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "needs_manual":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "not_bookable":
      return "border-primary/15 bg-primary/[0.04] text-primary/70";
    default:
      return "border-primary/15 bg-white text-primary/55";
  }
}

function prettifyStatus(status: BookingCandidateReviewStatus | null) {
  switch (status) {
    case "booking_found":
      return "Booking fundet";
    case "contact_only":
      return "Kontakt / manuel booking";
    case "needs_manual":
      return "Kræver research";
    case "not_bookable":
      return "Ikke bookbar";
    default:
      return "Ikke gennemgået";
  }
}

function extractInitialProvider(candidate: BookingCandidate): ShelterBookingProvider {
  const raw = candidate.shelter.booking_provider;
  if (raw && PROVIDER_OPTIONS.some((option) => option.value === raw)) {
    return raw;
  }
  if (candidate.suggestedBookingUrl?.includes("naturstyrelsen")) return "naturstyrelsen";
  if (candidate.suggestedBookingUrl?.includes("udinaturen")) return "udinaturen";
  if (candidate.suggestedBookingUrl?.includes("kommune")) return "kommune";
  return "private";
}

export function BookingCandidateReviewQueue({
  secret,
}: BookingCandidateReviewQueueProps) {
  const [status, setStatus] = useState<ReviewStatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BookingCandidateApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [drafts, setDrafts] = useState<
    Record<string, { bookingUrl: string; notes: string; provider: ShelterBookingProvider }>
  >({});

  const authHeaders = useMemo(() => ({ "x-admin-secret": secret }), [secret]);

  const ensureDrafts = useCallback((items: BookingCandidate[]) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const candidate of items) {
        if (!next[candidate.shelter.id]) {
          next[candidate.shelter.id] = {
            bookingUrl:
              candidate.review?.reviewed_booking_url ??
              candidate.suggestedBookingUrl ??
              "",
            notes: candidate.review?.notes ?? "",
            provider: extractInitialProvider(candidate),
          };
        }
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/booking-candidates?page=${page}&pageSize=20&status=${status}`,
        { headers: authHeaders }
      );
      const json = (await res.json()) as BookingCandidateApiResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Kunne ikke hente bookingkandidater");
        setData(null);
        return;
      }
      setData(json);
      ensureDrafts(json.items);
    } catch {
      setError("Kunne ikke hente bookingkandidater");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, ensureDrafts, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const updateDraft = (
    shelterId: string,
    field: "bookingUrl" | "notes" | "provider",
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [shelterId]: {
        ...(prev[shelterId] ?? {
          bookingUrl: "",
          notes: "",
          provider: "private" as ShelterBookingProvider,
        }),
        [field]: value,
      },
    }));
  };

  const performAction = async (
    candidate: BookingCandidate,
    action: "save_booking_url" | "mark_contact_only" | "mark_not_bookable" | "mark_needs_manual"
  ) => {
    const draft = drafts[candidate.shelter.id] ?? {
      bookingUrl: candidate.suggestedBookingUrl ?? "",
      notes: "",
      provider: extractInitialProvider(candidate),
    };

    setSavingId(candidate.shelter.id);
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[candidate.shelter.id];
      return next;
    });

    try {
      const res = await fetch("/api/admin/booking-candidates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          shelterId: candidate.shelter.id,
          action,
          bookingUrl: draft.bookingUrl,
          notes: draft.notes,
          provider: draft.provider,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback((prev) => ({
          ...prev,
          [candidate.shelter.id]: {
            ok: false,
            message: json.error ?? "Noget gik galt",
          },
        }));
        return;
      }
      setFeedback((prev) => ({
        ...prev,
        [candidate.shelter.id]: {
          ok: true,
          message:
            action === "save_booking_url"
              ? "Bookinglink gemt"
              : action === "mark_contact_only"
                ? "Markeret som kontakt / manuel booking"
                : action === "mark_not_bookable"
                  ? "Markeret som ikke bookbar"
                  : "Markeret til manuel research",
        },
      }));
      await load();
    } catch {
      setFeedback((prev) => ({
        ...prev,
        [candidate.shelter.id]: {
          ok: false,
          message: "Noget gik galt",
        },
      }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/10 bg-white p-6 space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">
            Potentielt bookbare shelters
          </h2>
          <p className="text-sm text-primary/50 mt-1">
            Kandidatkø baseret på bookingtekst og links i beskrivelser. Gennemgå lidt ad
            gangen og gem bookinglinket direkte herfra.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-primary/55">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReviewStatusFilter)}
            className="rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Alle kandidater", value: data.counts.total },
            { label: "Ikke gennemgået", value: data.counts.pending },
            { label: "Booking fundet", value: data.counts.booking_found },
            { label: "Kontakt / manuel", value: data.counts.contact_only },
            { label: "Kræver research", value: data.counts.needs_manual },
            { label: "Ikke bookbar", value: data.counts.not_bookable },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-primary/10 bg-primary/[0.03] px-4 py-3"
            >
              <p className="text-xs text-primary/45">{item.label}</p>
              <p className="text-lg font-semibold text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-primary/5 animate-pulse" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-primary/[0.03] px-4 py-8 text-sm text-primary/55 text-center">
          Ingen shelters matcher det valgte trin lige nu.
        </div>
      ) : (
        <div className="space-y-4">
          {data?.items.map((candidate) => {
            const shelterId = candidate.shelter.id;
            const draft = drafts[shelterId] ?? {
              bookingUrl: candidate.suggestedBookingUrl ?? "",
              notes: "",
              provider: extractInitialProvider(candidate),
            };
            const isSaving = savingId === shelterId;
            return (
              <article
                key={shelterId}
                className="rounded-xl border border-primary/10 bg-white p-4 space-y-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-primary">{candidate.shelter.title}</h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge(
                          candidate.review?.status ?? null
                        )}`}
                      >
                        {prettifyStatus(candidate.review?.status ?? null)}
                      </span>
                      <span className="text-[11px] rounded-full bg-accent/10 text-accent-dark px-2 py-0.5 font-medium">
                        Score {candidate.score}
                      </span>
                    </div>
                    <p className="text-sm text-primary/50">
                      {candidate.shelter.kommune || "Ukendt kommune"}
                      {candidate.shelter.region ? ` · ${candidate.shelter.region}` : ""}
                    </p>
                    <p className="text-xs text-primary/40 mt-1 font-mono">
                      /{candidate.shelter.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/shelter/${candidate.shelter.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary hover:bg-primary/5"
                    >
                      Åbn side
                    </a>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(candidate.shelter.title + " booking")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary hover:bg-primary/5"
                    >
                      Søg eksternt
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] gap-4">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-primary/10 bg-primary/[0.03] px-4 py-3">
                      <p className="text-xs font-medium text-primary/45 mb-1">Fundet i beskrivelse</p>
                      <p className="text-sm text-primary/75 leading-6">{candidate.excerpt || "Ingen uddrag tilgængeligt."}</p>
                    </div>

                    {candidate.foundBookingUrls.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-primary/45 mb-2">Fundne bookinglinks</p>
                        <div className="space-y-2">
                          {candidate.foundBookingUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-lg border border-primary/10 px-3 py-2 text-sm text-accent-dark break-all hover:bg-primary/[0.03]"
                            >
                              {url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {candidate.positiveSignals.map((signal) => (
                        <span
                          key={`pos-${signal}`}
                          className="text-[11px] rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 font-medium"
                        >
                          {signal}
                        </span>
                      ))}
                      {candidate.negativeSignals.map((signal) => (
                        <span
                          key={`neg-${signal}`}
                          className="text-[11px] rounded-full border border-red-200 bg-red-50 text-red-700 px-2 py-0.5 font-medium"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/10 bg-white p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-primary/45 mb-1">
                        Booking-URL
                      </label>
                      <input
                        type="url"
                        value={draft.bookingUrl}
                        onChange={(e) => updateDraft(shelterId, "bookingUrl", e.target.value)}
                        placeholder="https://…"
                        className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-primary/45 mb-1">
                        Bookingudbyder
                      </label>
                      <select
                        value={draft.provider}
                        onChange={(e) => updateDraft(shelterId, "provider", e.target.value)}
                        className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {PROVIDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-primary/45 mb-1">
                        Noter
                      </label>
                      <textarea
                        rows={4}
                        value={draft.notes}
                        onChange={(e) => updateDraft(shelterId, "notes", e.target.value)}
                        placeholder="Fx 'kræver MobilePay efter telefonisk aftale' eller 'ekstern booking fundet i PDF'."
                        className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => performAction(candidate, "save_booking_url")}
                        disabled={isSaving || !draft.bookingUrl.trim()}
                        className="rounded-lg bg-accent-dark text-white px-4 py-2 text-sm font-medium hover:bg-accent-dark/90 disabled:opacity-50"
                      >
                        Gem bookinglink
                      </button>
                      <button
                        onClick={() => performAction(candidate, "mark_contact_only")}
                        disabled={isSaving}
                        className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
                      >
                        Manuel / kontakt
                      </button>
                      <button
                        onClick={() => performAction(candidate, "mark_needs_manual")}
                        disabled={isSaving}
                        className="rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
                      >
                        Kræver research
                      </button>
                      <button
                        onClick={() => performAction(candidate, "mark_not_bookable")}
                        disabled={isSaving}
                        className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        Ikke bookbar
                      </button>
                    </div>

                    {feedback[shelterId] && (
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          feedback[shelterId].ok
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {feedback[shelterId].message}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-primary/8 pt-4">
          <p className="text-sm text-primary/45">
            Side {data.page} af {data.totalPages} · {data.total} kandidater
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              Forrige
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(data.totalPages, prev + 1))}
              disabled={page >= data.totalPages || loading}
              className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              Næste
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
