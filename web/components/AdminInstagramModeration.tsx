"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Lock, RefreshCw, Trash2, X } from "lucide-react";

const STORAGE_KEY = "shelterdk-admin-secret";

type IgPost = {
  id: string;
  post_url: string;
  status: string;
  moderation_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function AdminInstagramModeration() {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  const loadStored = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setSecret(stored);
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  const fetchAll = useCallback(async (s: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/instagram?t=${Date.now()}`, {
        headers: { "x-admin-secret": s },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("Ugyldig kode");
        sessionStorage.removeItem(STORAGE_KEY);
        setSecret("");
        setPosts([]);
        return;
      }
      if (!res.ok) {
        setError("Kunne ikke hente liste");
        return;
      }
      const data = await res.json();
      if (data.setupRequired) {
        setSetupRequired(true);
        setPosts([]);
        return;
      }
      setSetupRequired(false);
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secret) {
      sessionStorage.setItem(STORAGE_KEY, secret);
      fetchAll(secret);
    }
  }, [secret, fetchAll]);

  const submitNew = async () => {
    if (!secret || !newUrl.trim()) return;
    setActingId("new");
    setError("");
    try {
      const res = await fetch("/api/admin/instagram-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ postUrl: newUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunne ikke tilføje");
        return;
      }
      setNewUrl("");
      await fetchAll(secret);
    } finally {
      setActingId(null);
    }
  };

  const approve = async (id: string) => {
    if (!secret) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fejl");
        return;
      }
      await fetchAll(secret);
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: string) => {
    if (!secret) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fejl");
        return;
      }
      await fetchAll(secret);
    } finally {
      setActingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!secret) return;
    if (!confirm("Fjerne dette opslag fra databasen?")) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fejl");
        return;
      }
      await fetchAll(secret);
    } finally {
      setActingId(null);
    }
  };

  const pending = posts.filter((p) => p.status === "pending");
  const approved = posts.filter((p) => p.status === "approved");
  const rejected = posts.filter((p) => p.status === "rejected");

  if (!secret) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-white p-8 shadow-sm max-w-md">
        <div className="flex items-center gap-2 text-primary mb-4">
          <Lock size={20} />
          <h2 className="font-serif text-xl font-bold">Admin</h2>
        </div>
        <p className="text-primary/80 text-sm mb-4">Indtast admin-kode for at kuratere Instagram-opslag.</p>
        <input
          type="password"
          value={inputSecret}
          onChange={(e) => setInputSecret(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSecret(inputSecret)}
          className="w-full border border-primary/20 rounded-lg px-3 py-2 mb-3"
          placeholder="Admin secret"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setSecret(inputSecret)}
          className="w-full bg-accent-dark text-white font-medium py-2 rounded-lg hover:bg-accent-dark/90"
        >
          Fortsæt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold text-primary">Instagram-opslag</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAll(secret)}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Opdater
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setSecret("");
              setPosts([]);
            }}
            className="text-sm text-primary/60 hover:text-primary"
          >
            Log ud
          </button>
        </div>
      </div>

      {setupRequired && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          Tabellen <code className="font-mono">instagram_posts</code> findes ikke endnu. Kør migration{" "}
          <code className="font-mono">030_instagram_posts.sql</code> i Supabase SQL Editor.
        </p>
      )}

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-primary/10 bg-white p-6">
        <h2 className="font-semibold text-primary mb-3">Tilføj Instagram-URL</h2>
        <p className="text-sm text-primary/70 mb-3">
          Indsæt link til et opslag (fx <code className="text-xs">instagram.com/p/…</code> eller{" "}
          <code className="text-xs">/reel/…</code>). Efter godkendelse vises det i widgetten på blog og fakta.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            className="flex-1 border border-primary/20 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={actingId === "new" || !newUrl.trim()}
            className="inline-flex items-center justify-center gap-2 bg-accent-dark text-white font-medium px-4 py-2 rounded-lg hover:bg-accent-dark/90 disabled:opacity-50"
          >
            {actingId === "new" ? <Loader2 className="animate-spin" size={18} /> : null}
            Tilføj
          </button>
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-bold text-primary mb-3">Afventer godkendelse ({pending.length})</h2>
          <ul className="space-y-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/10 bg-white p-4"
              >
                <a
                  href={p.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline text-sm break-all flex items-center gap-1"
                >
                  {p.post_url}
                  <ExternalLink size={14} />
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approve(p.id)}
                    disabled={actingId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={16} /> Godkend
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(p.id)}
                    disabled={actingId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/20 px-3 py-1.5 text-sm hover:bg-primary/5"
                  >
                    <X size={16} /> Afvis
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {approved.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-bold text-primary mb-3">Godkendt ({approved.length})</h2>
          <ul className="space-y-2">
            {approved.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/10 bg-white p-3 text-sm"
              >
                <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="text-accent break-all">
                  {p.post_url}
                </a>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={actingId === p.id}
                  className="inline-flex items-center gap-1 text-red-600 hover:underline text-sm"
                >
                  <Trash2 size={14} /> Fjern
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rejected.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-bold text-primary/70 mb-3">Afvist ({rejected.length})</h2>
          <ul className="space-y-1 text-sm text-primary/60">
            {rejected.map((p) => (
              <li key={p.id} className="break-all">
                {p.post_url}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading && posts.length === 0 && !setupRequired && (
        <p className="text-primary/60 text-sm flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Indlæser…
        </p>
      )}

      <p className="text-sm text-primary/60">
        <Link href="/admin" className="text-accent hover:underline">
          Tilbage til admin
        </Link>
      </p>
    </div>
  );
}
