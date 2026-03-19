"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, X, Loader2, Lock, RefreshCw } from "lucide-react";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { FACILITY_FIELDS } from "@/lib/community";

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

type CommunitySubmission = {
  id: string;
  shelter_id: string;
  type: "comment" | "facilities_update";
  payload: Record<string, unknown> | null;
  status: string;
  submitter_name: string | null;
  submitter_email: string | null;
  created_at: string;
  shelter: { title: string; slug: string } | null;
};

export function AdminPhotoReview({ initialTab = "photos" }: { initialTab?: "photos" | "community" }) {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [communitySubmissions, setCommunitySubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"photos" | "community">(initialTab);

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
        const ts = Date.now();
        const [photoRes, communityRes] = await Promise.all([
          fetch(`/api/admin/pending-photos?t=${ts}`, {
            headers: { "x-admin-secret": s },
            cache: "no-store",
          }),
          fetch(`/api/admin/pending-community?t=${ts}`, {
            headers: { "x-admin-secret": s },
            cache: "no-store",
          }),
        ]);
        if (photoRes.status === 401 || communityRes.status === 401) {
          setError("Ugyldig kode");
          sessionStorage.removeItem(STORAGE_KEY);
          setSecret("");
          setSubmissions([]);
          setCommunitySubmissions([]);
          return;
        }
        if (!photoRes.ok || !communityRes.ok) {
          setError("Kunne ikke hente liste");
          return;
        }
        const [photoData, communityData] = await Promise.all([
          photoRes.json(),
          communityRes.json(),
        ]);
        setSubmissions(photoData.submissions ?? []);
        setCommunitySubmissions(communityData.submissions ?? []);
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
  }, [secret, fetchPending]);

  useEffect(() => {
    if (!secret) return;
    const id = window.setInterval(() => {
      fetchPending(secret);
    }, 10000);
    return () => window.clearInterval(id);
  }, [secret, fetchPending]);

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
    setCommunitySubmissions([]);
  };

  const act = async (
    submissionId: string,
    action: "approve" | "reject",
    kind: "photo" | "community" = "photo"
  ) => {
    if (!secret) return;
    setActingId(submissionId);
    const endpoint =
      kind === "photo"
        ? action === "approve"
          ? "/api/admin/approve-photo"
          : "/api/admin/reject-photo"
        : action === "approve"
          ? "/api/admin/approve-community"
          : "/api/admin/reject-community";
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
      if (kind === "photo") {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      } else {
        setCommunitySubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      }
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
        <h1 className="font-serif text-2xl font-bold text-primary">Community moderation</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => secret && fetchPending(secret)}
            className="inline-flex items-center gap-1.5 text-sm text-primary/70 hover:text-primary"
          >
            <RefreshCw size={14} />
            Opdater
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-primary/70 hover:text-primary"
          >
            Log ud
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-5 inline-flex rounded-lg border border-primary/15 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("photos")}
          className={`px-3 py-1.5 rounded-md text-sm ${
            tab === "photos" ? "bg-primary text-white" : "text-primary/75 hover:bg-primary/5"
          }`}
        >
          Billeder ({submissions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("community")}
          className={`px-3 py-1.5 rounded-md text-sm ${
            tab === "community" ? "bg-primary text-white" : "text-primary/75 hover:bg-primary/5"
          }`}
        >
          Kommentarer og faciliteter ({communitySubmissions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-primary/70">
          <Loader2 size={20} className="animate-spin" />
          Henter…
        </div>
      ) : tab === "photos" && submissions.length === 0 ? (
        <p className="text-primary/70">Ingen billeder venter på godkendelse.</p>
      ) : tab === "photos" ? (
        <ul className="space-y-6">
          {submissions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap gap-6 rounded-xl border border-primary/10 bg-white p-4 sm:flex-nowrap"
            >
              <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-primary/5 sm:w-48">
                {s.image_url ? (
                  <Image
                    src={getProxiedImageSrc(s.image_url)}
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
      ) : communitySubmissions.length === 0 ? (
        <p className="text-primary/70">Ingen community-indsendelser venter på godkendelse.</p>
      ) : (
        <ul className="space-y-4">
          {communitySubmissions.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-primary/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
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
                  <p className="mt-1 text-xs text-primary/60">
                    {new Date(s.created_at).toLocaleString("da-DK")}
                    {s.submitter_name ? ` · ${s.submitter_name}` : ""}
                    {s.submitter_email ? ` · ${s.submitter_email}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  {s.type === "comment" ? "Kommentar" : "Faciliteter"}
                </span>
              </div>

              {s.type === "comment" ? (
                <p className="mt-3 text-sm text-primary/90 whitespace-pre-line">
                  {String((s.payload as { text?: string } | null)?.text ?? "")}
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {FACILITY_FIELDS.map((f) => {
                    const val = (s.payload as Record<string, string> | null)?.[f.key];
                    if (!val) return null;
                    const label = val === "yes" ? "Ja" : val === "no" ? "Nej" : "Ved ikke";
                    return (
                      <div key={f.key} className="rounded border border-primary/10 px-2 py-1 text-primary/85">
                        {f.label}: <strong>{label}</strong>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(s.id, "approve", "community")}
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
                  onClick={() => act(s.id, "reject", "community")}
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
