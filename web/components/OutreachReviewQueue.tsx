"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  OutreachCandidate,
  OutreachReviewRow,
  OutreachReviewStatus,
} from "@/lib/outreach-candidates";

type StatusFilter = OutreachReviewStatus | "pending" | "all";

interface ApiResponse {
  items: OutreachCandidate[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: {
    total: number;
    pending: number;
    sent: number;
    replied: number;
    not_relevant: number;
    needs_research: number;
  };
}

interface Props {
  secret: string;
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "Ikke kontaktet" },
  { value: "sent", label: "Sendt" },
  { value: "replied", label: "Besvaret" },
  { value: "needs_research", label: "Kræver research" },
  { value: "not_relevant", label: "Ikke relevant" },
  { value: "all", label: "Alle" },
];

const SITE_ORIGIN =
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://shelterdk.dk";

function statusLabel(s: OutreachReviewStatus | null): string {
  switch (s) {
    case "sent": return "Sendt";
    case "replied": return "Besvaret";
    case "not_relevant": return "Ikke relevant";
    case "needs_research": return "Kræver research";
    default: return "Ikke kontaktet";
  }
}

function statusBadge(s: OutreachReviewStatus | null): string {
  switch (s) {
    case "sent": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "replied": return "border-blue-200 bg-blue-50 text-blue-700";
    case "not_relevant": return "border-primary/15 bg-primary/[0.04] text-primary/55";
    case "needs_research": return "border-amber-200 bg-amber-50 text-amber-700";
    default: return "border-primary/15 bg-white text-primary/55";
  }
}

function categoryBadge(category: "high" | "medium" | "low"): { label: string; cls: string } {
  switch (category) {
    case "high":
      return { label: "Høj prioritet", cls: "bg-amber-100 text-amber-800 border-amber-300" };
    case "medium":
      return { label: "Mellem", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    default:
      return { label: "Lav prioritet", cls: "bg-primary/5 text-primary/55 border-primary/10" };
  }
}

function renderTemplate(template: string, ctx: { shelter_title: string; shelter_url: string; recipient_name: string }): string {
  return template
    .replace(/\{shelter_title\}/g, ctx.shelter_title)
    .replace(/\{shelter_url\}/g, ctx.shelter_url)
    .replace(/\{recipient_name\}/g, ctx.recipient_name);
}

export function OutreachReviewQueue({ secret }: Props) {
  const authHeaders = useMemo(() => ({ "x-admin-secret": secret }), [secret]);

  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyShelterId, setBusyShelterId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [overrides, setOverrides] = useState<Record<string, { email: string; name: string }>>({});

  // Template-editor
  const [template, setTemplate] = useState<{ subject: string; body: string } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  // Preview-modal
  const [previewFor, setPreviewFor] = useState<OutreachCandidate | null>(null);

  // Hent listen. `silent` bruges til baggrunds-resync efter en optimistisk
  // opdatering — så vi ikke viser "Indlæser…" eller blanker listen mens den
  // tunge kandidat-scanning kører.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/outreach-candidates?status=${status}&page=${page}`, {
        headers: authHeaders,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Kunne ikke hente kandidater");
        if (!opts?.silent) setData(null);
      } else {
        setData(json as ApiResponse);
      }
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : "Netværksfejl");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [status, page, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hent template
  const loadTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/outreach/template`, { headers: authHeaders });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTemplate({ subject: json.subject, body: json.body });
      }
    } catch {
      /* ignore */
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const saveTemplate = async () => {
    if (!template) return;
    setTemplateSaving(true);
    setTemplateMsg(null);
    try {
      const res = await fetch(`/api/admin/outreach/template`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(template),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setTemplateMsg({ ok: false, text: json.error ?? "Fejl ved gem" });
      else setTemplateMsg({ ok: true, text: "Template gemt" });
    } catch {
      setTemplateMsg({ ok: false, text: "Netværksfejl" });
    } finally {
      setTemplateSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.includes("@")) {
      setTemplateMsg({ ok: false, text: "Indtast en gyldig e-mail til testmailen" });
      return;
    }
    setTestSending(true);
    setTemplateMsg(null);
    try {
      const res = await fetch(`/api/admin/outreach/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ email: testEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setTemplateMsg({ ok: false, text: json.error ?? "Kunne ikke sende testmail" });
      else setTemplateMsg({ ok: true, text: `Testmail sendt til ${testEmail}` });
    } catch {
      setTemplateMsg({ ok: false, text: "Netværksfejl" });
    } finally {
      setTestSending(false);
    }
  };

  // Seeder override fra kandidatens forslag FØRSTE gang et felt redigeres,
  // så redigering af ét felt (fx navn) ikke nulstiller det andet (email).
  const setOverride = (c: OutreachCandidate, patch: Partial<{ email: string; name: string }>) => {
    setOverrides((prev) => {
      const base = prev[c.shelter.id] ?? {
        email: c.recipientEmailSuggestion ?? "",
        name: c.recipientNameSuggestion ?? "",
      };
      return { ...prev, [c.shelter.id]: { ...base, ...patch } };
    });
  };

  const getRecipient = (c: OutreachCandidate): { email: string; name: string } => {
    const override = overrides[c.shelter.id];
    if (override) return override;
    return {
      email: c.recipientEmailSuggestion ?? "",
      name: c.recipientNameSuggestion ?? "",
    };
  };

  // Optimistisk opdatering: når et shelter får ny status, fjernes kortet
  // straks fra listen hvis den nye status ikke matcher det aktive filter
  // (fx "Ikke relevant" på "Ikke kontaktet"-filteret). På "Alle"-filteret —
  // eller hvis status matcher filteret — bliver kortet og får bare nyt badge.
  // Tæller-tallene justeres lokalt; en let baggrunds-reload finaliserer dem.
  const applyLocalStatus = useCallback(
    (c: OutreachCandidate, newStatus: OutreachReviewStatus, patch?: Partial<OutreachReviewRow>) => {
      setData((prev) => {
        if (!prev) return prev;
        const stays = status === "all" || status === newStatus;
        const prevKey = c.review?.status ?? "pending";
        const counts = { ...prev.counts } as Record<string, number>;
        if (prevKey in counts) counts[prevKey] = Math.max(0, counts[prevKey] - 1);
        if (newStatus in counts) counts[newStatus] += 1;

        const nowIso = new Date().toISOString();
        const items = stays
          ? prev.items.map((it) =>
              it.shelter.id === c.shelter.id
                ? {
                    ...it,
                    review: {
                      shelter_id: c.shelter.id,
                      status: newStatus,
                      recipient_email: patch?.recipient_email ?? it.review?.recipient_email ?? null,
                      recipient_name: patch?.recipient_name ?? it.review?.recipient_name ?? null,
                      notes: it.review?.notes ?? null,
                      sent_at: patch?.sent_at ?? it.review?.sent_at ?? null,
                      reviewed_at: nowIso,
                    } satisfies OutreachReviewRow,
                  }
                : it
            )
          : prev.items.filter((it) => it.shelter.id !== c.shelter.id);

        const total = stays ? prev.total : Math.max(0, prev.total - 1);
        const totalPages = Math.max(1, Math.ceil(total / prev.pageSize));
        return { ...prev, items, total, totalPages, counts: counts as ApiResponse["counts"] };
      });
    },
    [status]
  );

  const handleSend = async (c: OutreachCandidate) => {
    const { email, name } = getRecipient(c);
    if (!email || !email.includes("@")) {
      setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: "Indtast modtager-email først" } }));
      return;
    }
    if (!name.trim()) {
      setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: "Udfyld modtagerens navn først" } }));
      return;
    }
    const confirmText = `Send outreach-mail til ${email}?\n\nShelter: ${c.shelter.title}\nModtager: ${name}\n\nMailen sendes fra hej@shelterdk.dk.`;
    if (!window.confirm(confirmText)) return;
    setBusyShelterId(c.shelter.id);
    setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: true, text: "Sender…" } }));
    try {
      const res = await fetch(`/api/admin/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          shelter_id: c.shelter.id,
          recipient_email: email,
          recipient_name: name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: json.error ?? "Send fejlede" } }));
      } else {
        setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: true, text: json.warning ?? "Sendt ✓" } }));
        applyLocalStatus(c, "sent", {
          recipient_email: email,
          recipient_name: name,
          sent_at: new Date().toISOString(),
        });
        void load({ silent: true });
      }
    } catch {
      setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: "Netværksfejl" } }));
    } finally {
      setBusyShelterId(null);
    }
  };

  const handleStatusChange = async (c: OutreachCandidate, newStatus: OutreachReviewStatus) => {
    setBusyShelterId(c.shelter.id);
    try {
      const res = await fetch(`/api/admin/outreach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ shelter_id: c.shelter.id, status: newStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: json.error ?? "Fejl" } }));
      } else {
        applyLocalStatus(c, newStatus);
        void load({ silent: true });
      }
    } catch {
      setRowMessage((prev) => ({ ...prev, [c.shelter.id]: { ok: false, text: "Netværksfejl" } }));
    } finally {
      setBusyShelterId(null);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header: filter + counts */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="outreach-status" className="text-sm text-primary/55">Status:</label>
          <select
            id="outreach-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-primary/55">
            <span>Total: {data.counts.total}</span>
            <span>·</span>
            <span>Ikke kontaktet: {data.counts.pending}</span>
            <span>·</span>
            <span>Sendt: {data.counts.sent}</span>
            <span>·</span>
            <span>Besvaret: {data.counts.replied}</span>
          </div>
        )}
      </div>

      {/* Template-editor (foldbar) */}
      <details
        className="rounded-2xl border border-primary/10 bg-white"
        open={templateOpen}
        onToggle={(e) => setTemplateOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary flex items-center justify-between">
          <span>Email-template</span>
          <span className="text-xs text-primary/50">
            Brug {"{shelter_title}"}, {"{shelter_url}"}, {"{recipient_name}"} som placeholders
          </span>
        </summary>
        <div className="px-5 py-4 space-y-3 border-t border-primary/10">
          <div>
            <label htmlFor="tpl-subject" className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1">
              Emne
            </label>
            <input
              id="tpl-subject"
              type="text"
              value={template?.subject ?? ""}
              onChange={(e) => setTemplate((t) => (t ? { ...t, subject: e.target.value } : t))}
              disabled={!template}
              className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div>
            <label htmlFor="tpl-body" className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1">
              Body
            </label>
            <textarea
              id="tpl-body"
              value={template?.body ?? ""}
              onChange={(e) => setTemplate((t) => (t ? { ...t, body: e.target.value } : t))}
              disabled={!template}
              rows={16}
              className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveTemplate}
              disabled={templateSaving || !template}
              className="rounded-lg bg-accent-dark px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark/90 disabled:opacity-50"
            >
              {templateSaving ? "Gemmer…" : "Gem template"}
            </button>
            {templateMsg && (
              <span className={`text-sm ${templateMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{templateMsg.text}</span>
            )}
          </div>

          {/* Send testmail — se det faktiske HTML-output i din egen indbakke */}
          <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-primary/10">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="test-email" className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1">
                Send testmail til
              </label>
              <input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="din@email.dk"
                className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </div>
            <button
              type="button"
              onClick={sendTestEmail}
              disabled={testSending || !testEmail}
              className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {testSending ? "Sender…" : "Send testmail"}
            </button>
            <span className="text-xs text-primary/45 w-full">
              Sender den gemte template med eksempel-værdier. Markerer ikke noget shelter som kontaktet.
            </span>
          </div>
        </div>
      </details>

      {/* Liste */}
      {error && <p className="text-sm text-red-600">Fejl: {error}</p>}
      {loading && <p className="text-sm text-primary/55">Indlæser kandidater…</p>}
      {!loading && data && data.items.length === 0 && (
        <p className="text-sm text-primary/55">Ingen kandidater på dette filter.</p>
      )}

      <div className="space-y-3">
        {data?.items.map((c) => {
          const cat = categoryBadge(c.category);
          const recipient = getRecipient(c);
          const msg = rowMessage[c.shelter.id];
          const isBusy = busyShelterId === c.shelter.id;
          const shelterUrl = `${SITE_ORIGIN}/shelter/${c.shelter.slug ?? c.shelter.id}`;
          return (
            <div key={c.shelter.id} className="rounded-xl border border-primary/10 bg-white p-4">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={shelterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-base font-bold text-primary hover:underline truncate"
                    >
                      {c.shelter.title}
                    </a>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cat.cls}`}>
                      {cat.label} · score {c.score}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge(c.review?.status ?? null)}`}>
                      {statusLabel(c.review?.status ?? null)}
                    </span>
                  </div>
                  <p className="text-xs text-primary/50 mt-0.5">
                    {[c.shelter.kommune, c.shelter.region].filter(Boolean).join(" · ")}
                    {c.review?.sent_at && (
                      <> · Sendt {new Date(c.review.sent_at).toLocaleDateString("da-DK")}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Signaler */}
              {(c.signals.length > 0 || c.negativeSignals.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[11px]">
                  {c.signals.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent-dark border border-accent/20">
                      {s}
                    </span>
                  ))}
                  {c.negativeSignals.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-primary/5 text-primary/45 border border-primary/10">
                      − {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Excerpt */}
              {c.excerpt && (
                <p className="text-xs text-primary/55 italic mb-3 line-clamp-3">
                  {c.excerpt}
                </p>
              )}

              {/* Modtager-input */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor={`email-${c.shelter.id}`} className="block text-[11px] uppercase tracking-wide text-primary/45 mb-0.5">
                    Modtager-email
                  </label>
                  <input
                    id={`email-${c.shelter.id}`}
                    type="email"
                    value={recipient.email}
                    onChange={(e) => setOverride(c, { email: e.target.value })}
                    placeholder={c.recipientEmailSuggestion ?? "indtast email..."}
                    className="w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                  />
                </div>
                <div>
                  <label htmlFor={`name-${c.shelter.id}`} className="block text-[11px] uppercase tracking-wide text-primary/45 mb-0.5">
                    Navn (til hilsen)
                  </label>
                  <input
                    id={`name-${c.shelter.id}`}
                    type="text"
                    value={recipient.name}
                    onChange={(e) => setOverride(c, { name: e.target.value })}
                    placeholder="Fx Betina, foreningen el. kommune"
                    className="w-full rounded-lg border border-primary/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewFor(c)}
                    disabled={isBusy}
                    className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary/70 hover:bg-primary/5"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(c)}
                    disabled={isBusy || !recipient.email || !recipient.name.trim()}
                    title={!recipient.name.trim() ? "Udfyld modtagerens navn først" : undefined}
                    className="rounded-lg bg-accent-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark/90 disabled:opacity-50"
                  >
                    {isBusy ? "Sender…" : "Send"}
                  </button>
                </div>
              </div>

              {/* Action-knapper */}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleStatusChange(c, "not_relevant")}
                  disabled={isBusy}
                  className="text-primary/55 hover:text-primary px-2 py-0.5 rounded hover:bg-primary/5"
                >
                  Ikke relevant
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(c, "needs_research")}
                  disabled={isBusy}
                  className="text-primary/55 hover:text-primary px-2 py-0.5 rounded hover:bg-primary/5"
                >
                  Kræver research
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(c, "replied")}
                  disabled={isBusy}
                  className="text-primary/55 hover:text-primary px-2 py-0.5 rounded hover:bg-primary/5"
                >
                  Markér som besvaret
                </button>
                {msg && (
                  <span className={`ml-auto ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginering */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-primary/15 disabled:opacity-40"
          >
            ← Forrige
          </button>
          <span className="text-sm text-primary/55">Side {data.page} af {data.totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-primary/15 disabled:opacity-40"
          >
            Næste →
          </button>
        </div>
      )}

      {/* Preview-modal */}
      {previewFor && template && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setPreviewFor(null)}
            className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]"
            aria-label="Luk preview"
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-primary/10 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-primary">Email-preview</h2>
              <button
                type="button"
                onClick={() => setPreviewFor(null)}
                className="text-primary/55 hover:text-primary text-sm"
              >
                Luk
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-3">
              {(() => {
                const ctx = {
                  shelter_title: previewFor.shelter.title,
                  shelter_url: `${SITE_ORIGIN}/shelter/${previewFor.shelter.slug ?? previewFor.shelter.id}`,
                  recipient_name: getRecipient(previewFor).name,
                };
                const subject = renderTemplate(template.subject, ctx);
                const body = renderTemplate(template.body, ctx);
                return (
                  <>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-primary/45 mb-0.5">Til</div>
                      <p className="text-sm text-primary">{getRecipient(previewFor).email || "(indtast email først)"}</p>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-primary/45 mb-0.5">Emne</div>
                      <p className="text-sm font-semibold text-primary">{subject}</p>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-primary/45 mb-0.5">Body</div>
                      <pre className="text-sm text-primary/80 whitespace-pre-wrap font-sans leading-relaxed bg-primary/[0.02] border border-primary/10 rounded-lg p-3">{body}</pre>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
