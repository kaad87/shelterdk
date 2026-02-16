"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, X, Loader2, Lock } from "lucide-react";

const STORAGE_KEY = "shelterdk-admin-secret";

type Submission = {
  id: string;
  shelter_id: string;
  file_path: string;
  storage_bucket: string;
  submitter_email: string | null;
  status: string;
  created_at: string;
  shelter: { title: string; slug: string } | null;
  image_url: string | null;
};

export function AdminPhotoReview() {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const loadStored = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setSecret(stored);
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  const fetchPending = useCallback(
    async (s: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/pending-photos", {
          headers: { "x-admin-secret": s },
        });
        if (res.status === 401) {
          setError("Ugyldig kode");
          sessionStorage.removeItem(STORAGE_KEY);
          setSecret("");
          setSubmissions([]);
          return;
        }
        if (!res.ok) {
          setError("Kunne ikke hente liste");
          return;
        }
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (secret) {
      sessionStorage.setItem(STORAGE_KEY, secret);
      fetchPending(secret);
    } else {
      setSubmissions([]);
    }
  }, [secret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const s = inputSecret.trim();
    if (!s) return;
    setSecret(s);
    setInputSecret("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSecret("");
    setInputSecret("");
    setSubmissions([]);
  };

  const act = async (
    submissionId: string,
    action: "approve" | "reject"
  ) => {
    if (!secret) return;
    setActingId(submissionId);
    const endpoint =
      action === "approve"
        ? "/api/admin/approve-photo"
        : "/api/admin/reject-photo";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Fejl");
        return;
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    } finally {
      setActingId(null);
    }
  };

  if (!secret) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-primary mb-4">
          <Lock size={20} />
          <h1 className="font-serif text-xl font-bold">Admin – godkend billeder</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm font-medium text-primary">
            Indtast admin-kode
          </label>
          <input
            type="password"
            value={inputSecret}
            onChange={(e) => setInputSecret(e.target.value)}
            className="w-full rounded-lg border border-primary/20 px-3 py-2 text-primary"
            placeholder="Kode"
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-accent py-2 text-white font-medium hover:bg-accent/90"
          >
            Log ind
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-primary">
          Billeder til godkendelse
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-primary/70 hover:text-primary"
        >
          Log ud
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-primary/70">
          <Loader2 size={20} className="animate-spin" />
          Henter…
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-primary/70">Ingen billeder venter på godkendelse.</p>
      ) : (
        <ul className="space-y-6">
          {submissions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap gap-6 rounded-xl border border-primary/10 bg-white p-4 sm:flex-nowrap"
            >
              <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-primary/5 sm:w-48">
                {s.image_url ? (
                  <Image
                    src={s.image_url}
                    alt={`Forslag til billede for ${s.shelter?.title ?? "shelter"}`}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="192px"
                  />
                ) : (
                  <span className="text-primary/50 text-sm">Ingen forhåndsvisning</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-primary">
                  {s.shelter?.title ?? "Ukendt shelter"}
                </p>
                {s.shelter?.slug && (
                  <Link
                    href={`/shelter/${s.shelter.slug}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Se shelter →
                  </Link>
                )}
                {s.submitter_email && (
                  <p className="mt-1 text-sm text-primary/70">
                    Indsender: {s.submitter_email}
                  </p>
                )}
                <p className="text-primary/60 text-xs mt-1">
                  {new Date(s.created_at).toLocaleString("da-DK")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => act(s.id, "approve")}
                  disabled={actingId != null}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {actingId === s.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Godkend
                </button>
                <button
                  type="button"
                  onClick={() => act(s.id, "reject")}
                  disabled={actingId != null}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {actingId === s.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <X size={16} />
                  )}
                  Afvis
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
