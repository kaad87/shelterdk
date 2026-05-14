"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "shelterdk-admin-secret";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: "unread" | "read" | "replied" | "archived";
  created_at: string;
};

type Tab = "alle" | "unread" | "replied" | "archived";

const STATUS_LABELS: Record<ContactMessage["status"], string> = {
  unread: "Ulæst",
  read: "Læst",
  replied: "Besvaret",
  archived: "Arkiveret",
};

const STATUS_COLORS: Record<ContactMessage["status"], string> = {
  unread: "bg-amber-100 text-amber-800",
  read: "bg-gray-100 text-gray-600",
  replied: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "Generelt",
  fejl: "Fejl",
  forslag: "Forslag",
  andet: "Andet",
};

export default function AdminKontaktPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : ""
  );
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("alle");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!secret) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/contact", {
          headers: { "x-admin-secret": secret },
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401) throw new Error("401");
          throw new Error(data.error ?? "FETCH_FAILED");
        }
        if (!cancelled) {
          setMessages((data.messages ?? []) as ContactMessage[]);
          setErrorMsg(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message === "401") setAuthError(true);
          else setErrorMsg(err instanceof Error ? err.message : "Kunne ikke hente beskeder.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [secret]);

  async function refresh() {
    const r = await fetch("/api/admin/contact", { headers: { "x-admin-secret": secret } });
    const data = await r.json().catch(() => ({}));
    if (r.ok) setMessages((data.messages ?? []) as ContactMessage[]);
  }

  async function handleArchive(id: string) {
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id, status: "archived" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke arkivere");
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReply(id: string) {
    const replyText = replyTexts[id]?.trim();
    if (!replyText) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id, replyText }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke sende svar");
      setReplyOpen(null);
      setReplyTexts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = messages.filter((m) => {
    if (activeTab === "alle") return true;
    if (activeTab === "unread") return m.status === "unread";
    if (activeTab === "replied") return m.status === "replied";
    if (activeTab === "archived") return m.status === "archived";
    return true;
  });

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-primary/60 text-sm">
            Log ind via{" "}
            <Link href="/admin" className="text-accent underline">
              admin-forsiden
            </Link>{" "}
            først.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <nav className="text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Kontaktbeskeder</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-primary">Kontaktbeskeder</h1>
        <p className="text-sm text-primary/60 mt-1">Henvendelser fra kontaktformularen.</p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-primary/10">
        {(["alle", "unread", "replied", "archived"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-primary/60 hover:text-primary"
            }`}
          >
            {tab === "alle" && `Alle (${messages.length})`}
            {tab === "unread" && `Ulæste${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            {tab === "replied" && "Besvaret"}
            {tab === "archived" && "Arkiveret"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Indlæser beskeder…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Ingen beskeder.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((msg) => (
            <article
              key={msg.id}
              className="rounded-xl border border-primary/10 bg-white p-5 space-y-3"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary text-sm">{msg.name}</p>
                  <p className="text-xs text-primary/50">{msg.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-primary/40">
                    {new Date(msg.created_at).toLocaleString("da-DK")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[msg.status]}`}
                  >
                    {STATUS_LABELS[msg.status]}
                  </span>
                  <span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs text-primary/60">
                    {CATEGORY_LABELS[msg.category] ?? msg.category}
                  </span>
                </div>
              </div>

              {/* Message body */}
              <p className="text-sm text-primary/80 leading-relaxed whitespace-pre-wrap">
                {msg.message}
              </p>

              {/* Inline reply form */}
              {replyOpen === msg.id && (
                <div className="space-y-2 pt-1 border-t border-primary/10">
                  <textarea
                    rows={5}
                    value={replyTexts[msg.id] ?? ""}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                    }
                    placeholder="Skriv dit svar…"
                    className="block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm resize-y mt-3"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReply(msg.id)}
                      disabled={busyId === msg.id || !replyTexts[msg.id]?.trim()}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === msg.id ? "Sender…" : "Send svar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyOpen(null)}
                      disabled={busyId === msg.id}
                      className="rounded-lg border border-primary/15 px-4 py-2 text-sm text-primary/60 hover:text-primary disabled:opacity-50"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {replyOpen !== msg.id && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReplyOpen(msg.id)}
                    disabled={busyId === msg.id}
                    className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Besvar
                  </button>
                  {msg.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(msg.id)}
                      disabled={busyId === msg.id}
                      className="rounded-lg border border-primary/15 px-4 py-2 text-sm text-primary/60 hover:text-primary disabled:opacity-50"
                    >
                      Arkivér
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
