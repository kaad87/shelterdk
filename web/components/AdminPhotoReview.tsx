"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import {
  Check,
  X,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
  ExternalLink,
  Instagram,
  Camera,
  MessageSquare,
  Plus,
  Mail,
  Download,
  Inbox,
  Archive,
  Eye,
} from "lucide-react";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { FACILITY_FIELDS } from "@/lib/community";
import type { ShelterSubmission } from "@/lib/shelter-submissions";
import { FACILITY_LABELS } from "@/lib/shelter-submissions";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const STORAGE_KEY = "shelterdk-admin-secret";

type TabKey = "photos" | "community" | "instagram" | "newsletter" | "contact" | "oplevelser" | "submissions";

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

type IgPost = {
  id: string;
  post_url: string;
  status: string;
  moderation_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type NewsletterSub = {
  id: string;
  email: string;
  source: string;
  created_at: string;
};

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
};

type Experience = {
  id: string;
  shelter_id: string;
  author_name: string;
  body: string;
  photo_urls: string[];
  cover_photo_index: number;
  status: string;
  created_at: string;
  shelter: { title: string; slug: string } | null;
};

const HASHTAGS = [
  { tag: "sheltertur", label: "Shelterture" },
  { tag: "natinaturen", label: "Nat i Naturen" },
  { tag: "primitvovernatning", label: "Primitiv overnatning" },
  { tag: "shelterliv", label: "Shelterliv" },
  { tag: "friluftsliv", label: "Friluftsliv DK" },
  { tag: "bålhygge", label: "Bålhygge" },
  { tag: "udinaturen", label: "Ud i naturen" },
  { tag: "shelterplads", label: "Shelterplads" },
];

const TAB_CONFIG: { key: TabKey; label: string; icon: typeof Camera }[] = [
  { key: "photos", label: "Billeder", icon: Camera },
  { key: "community", label: "Community", icon: MessageSquare },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "newsletter", label: "Nyhedsbrev", icon: Mail },
  { key: "contact", label: "Beskeder", icon: Inbox },
  { key: "oplevelser", label: "Oplevelser", icon: Camera },
  { key: "submissions", label: "Indsendte", icon: Plus },
];

export function AdminPhotoReview({ initialTab = "photos" }: { initialTab?: TabKey }) {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [communitySubmissions, setCommunitySubmissions] = useState<CommunitySubmission[]>([]);
  const [igPosts, setIgPosts] = useState<IgPost[]>([]);
  const [igSetupRequired, setIgSetupRequired] = useState(false);
  const [nlSubs, setNlSubs] = useState<NewsletterSub[]>([]);
  const [contactMsgs, setContactMsgs] = useState<ContactMessage[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [shelterSubmissions, setShelterSubmissions] = useState<ShelterSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [newIgUrl, setNewIgUrl] = useState("");
  const [igScriptReady, setIgScriptReady] = useState(false);
  const embedRef = useRef(0);

  const processEmbeds = useCallback(() => {
    if (typeof window !== "undefined" && window.instgrm?.Embeds) {
      window.instgrm.Embeds.process();
    }
  }, []);

  useEffect(() => {
    if (!igScriptReady || tab !== "instagram") return;
    embedRef.current += 1;
    const ver = embedRef.current;
    const t = setTimeout(() => {
      if (ver === embedRef.current) processEmbeds();
    }, 300);
    return () => clearTimeout(t);
  }, [igScriptReady, tab, igPosts, processEmbeds]);

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
      const ts = Date.now();
      const [photoRes, communityRes, igRes, nlRes, contactRes, experiencesRes, submissionsRes] = await Promise.all([
        fetch(`/api/admin/pending-photos?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/pending-community?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/instagram?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/newsletter?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/contact?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/pending-experiences?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/pending-shelter-submissions?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
      ]);
      if (photoRes.status === 401 || communityRes.status === 401 || igRes.status === 401 || nlRes.status === 401) {
        setError("Ugyldig kode");
        sessionStorage.removeItem(STORAGE_KEY);
        setSecret("");
        setSubmissions([]);
        setCommunitySubmissions([]);
        setIgPosts([]);
        setNlSubs([]);
        setContactMsgs([]);
        setExperiences([]);
        setShelterSubmissions([]);
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

      if (igRes.ok) {
        const igData = await igRes.json();
        if (igData.setupRequired) {
          setIgSetupRequired(true);
          setIgPosts([]);
        } else {
          setIgSetupRequired(false);
          setIgPosts(igData.posts ?? []);
        }
      }

      if (nlRes.ok) {
        const nlData = await nlRes.json();
        setNlSubs(nlData.subscribers ?? []);
      }

      if (contactRes.ok) {
        const contactData = await contactRes.json();
        setContactMsgs(contactData.messages ?? []);
      }

      if (experiencesRes.ok) {
        const expData = await experiencesRes.json();
        setExperiences(expData.experiences ?? []);
      }

      if (submissionsRes.ok) {
        const subsData = await submissionsRes.json();
        setShelterSubmissions(subsData.submissions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secret) {
      sessionStorage.setItem(STORAGE_KEY, secret);
      fetchAll(secret);
    } else {
      setSubmissions([]);
    }
  }, [secret, fetchAll]);

  useEffect(() => {
    if (!secret) return;
    const id = window.setInterval(() => {
      fetchAll(secret);
    }, 15000);
    return () => window.clearInterval(id);
  }, [secret, fetchAll]);

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
    setIgPosts([]);
    setNlSubs([]);
    setContactMsgs([]);
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

  // ── Instagram actions ──

  const igSubmit = async (url: string) => {
    if (!secret || !url.trim()) return;
    setActingId("ig-new");
    setError("");
    try {
      const res = await fetch("/api/admin/instagram-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ postUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunne ikke tilføje");
        return;
      }
      if (data.message) setError(data.message);
      setNewIgUrl("");
      await fetchAll(secret);
    } finally {
      setActingId(null);
    }
  };

  const igApprove = async (id: string) => {
    if (!secret) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
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

  const igReject = async (id: string) => {
    if (!secret) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
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

  const igRemove = async (id: string) => {
    if (!secret) return;
    if (!confirm("Fjerne dette opslag fra databasen?")) return;
    setActingId(id);
    try {
      const res = await fetch("/api/admin/instagram-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
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

  const igPending = igPosts.filter((p) => p.status === "pending");
  const igApproved = igPosts.filter((p) => p.status === "approved");
  const igRejected = igPosts.filter((p) => p.status === "rejected");

  // ── badge counts ──
  const unreadMsgs = contactMsgs.filter((m) => m.status === "unread");
  const badgeCounts: Record<TabKey, number> = {
    photos: submissions.length,
    community: communitySubmissions.length,
    instagram: igPending.length,
    newsletter: nlSubs.length,
    contact: unreadMsgs.length,
    oplevelser: experiences.length,
    submissions: shelterSubmissions.length,
  };

  // ── Login screen ──

  if (!secret) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="rounded-2xl border border-primary/10 bg-white p-8 shadow-lg shadow-primary/5">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
              <Lock size={22} className="text-primary/70" />
            </div>
            <h1 className="font-serif text-xl font-bold text-primary">Admin panel</h1>
            <p className="text-sm text-primary/60 text-center">
              Godkend billeder, community-bidrag og kurater Instagram-opslag.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={inputSecret}
              onChange={(e) => setInputSecret(e.target.value)}
              className="w-full rounded-xl border border-primary/15 bg-primary/[0.02] px-4 py-3 text-primary placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
              placeholder="Indtast admin-kode"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-accent py-3 text-white font-semibold hover:bg-accent/90 transition-colors shadow-sm"
            >
              Log ind
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Main panel ──

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-primary">Moderation</h1>
          <p className="text-sm text-primary/60 mt-1">Godkend indhold fra brugere og kurater Instagram-feed.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => secret && fetchAll(secret)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary/70 hover:text-primary hover:border-primary/30 transition-colors shadow-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Opdater
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-primary/50 hover:text-primary transition-colors"
          >
            Log ud
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-3 text-red-500 hover:text-red-700 font-medium"
          >
            Luk
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-primary/10 bg-primary/[0.02] p-1.5">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => {
          const count = badgeCounts[key];
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-primary shadow-sm"
                  : "text-primary/55 hover:text-primary/80 hover:bg-white/50"
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
              {count > 0 && (
                <span
                  className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                    isActive ? "bg-accent text-white" : "bg-primary/10 text-primary/60"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && submissions.length === 0 && communitySubmissions.length === 0 && igPosts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-primary/50">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Henter data…</p>
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && !loading && (
        submissions.length === 0 ? (
          <EmptyState icon={Camera} text="Ingen billeder venter på godkendelse." />
        ) : (
          <ul className="space-y-4">
            {submissions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap gap-5 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm sm:flex-nowrap"
              >
                <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-primary/5 sm:w-52">
                  {s.image_url ? (
                    <Image
                      src={getProxiedImageSrc(s.image_url)}
                      alt={`Forslag til billede for ${s.shelter?.title ?? "shelter"}`}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="208px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Camera size={24} className="text-primary/30" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-semibold text-primary">{s.shelter?.title ?? "Ukendt shelter"}</p>
                    {s.shelter?.slug && (
                      <Link href={`/shelter/${s.shelter.slug}`} className="text-sm text-accent hover:underline">
                        Se shelter →
                      </Link>
                    )}
                    {s.submitter_email && (
                      <p className="mt-1 text-sm text-primary/60">Indsender: {s.submitter_email}</p>
                    )}
                    <p className="text-primary/50 text-xs mt-1">
                      {new Date(s.created_at).toLocaleString("da-DK")}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <ActionButton
                      variant="approve"
                      onClick={() => act(s.id, "approve")}
                      loading={actingId === s.id}
                      disabled={actingId != null}
                    />
                    <ActionButton
                      variant="reject"
                      onClick={() => act(s.id, "reject")}
                      loading={actingId === s.id}
                      disabled={actingId != null}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Community tab */}
      {tab === "community" && !loading && (
        communitySubmissions.length === 0 ? (
          <EmptyState icon={MessageSquare} text="Ingen community-bidrag venter på godkendelse." />
        ) : (
          <ul className="space-y-4">
            {communitySubmissions.map((s) => (
              <li key={s.id} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-primary">{s.shelter?.title ?? "Ukendt shelter"}</p>
                    {s.shelter?.slug && (
                      <Link href={`/shelter/${s.shelter.slug}`} className="text-sm text-accent hover:underline">
                        Se shelter →
                      </Link>
                    )}
                    <p className="mt-1 text-xs text-primary/50">
                      {new Date(s.created_at).toLocaleString("da-DK")}
                      {s.submitter_name ? ` · ${s.submitter_name}` : ""}
                      {s.submitter_email ? ` · ${s.submitter_email}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary/70">
                    {s.type === "comment" ? "Kommentar" : "Faciliteter"}
                  </span>
                </div>

                {s.type === "comment" ? (
                  <p className="mt-4 text-sm text-primary/85 whitespace-pre-line bg-primary/[0.02] rounded-xl p-4 border border-primary/5">
                    {String((s.payload as { text?: string } | null)?.text ?? "")}
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {FACILITY_FIELDS.map((f) => {
                      const val = (s.payload as Record<string, string> | null)?.[f.key];
                      if (!val) return null;
                      const label = val === "yes" ? "Ja" : val === "no" ? "Nej" : "Ved ikke";
                      return (
                        <div key={f.key} className="rounded-lg border border-primary/10 px-3 py-2 text-primary/80 bg-primary/[0.02]">
                          {f.label}: <strong>{label}</strong>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <ActionButton
                    variant="approve"
                    onClick={() => act(s.id, "approve", "community")}
                    loading={actingId === s.id}
                    disabled={actingId != null}
                  />
                  <ActionButton
                    variant="reject"
                    onClick={() => act(s.id, "reject", "community")}
                    loading={actingId === s.id}
                    disabled={actingId != null}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Instagram tab */}
      {tab === "instagram" && !loading && (
        <div className="space-y-6">
          <Script
            src="https://www.instagram.com/embed.js"
            strategy="lazyOnload"
            onLoad={() => {
              setIgScriptReady(true);
              processEmbeds();
            }}
          />

          {igSetupRequired && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Tabellen <code className="font-mono bg-amber-100 px-1 rounded">instagram_posts</code> findes
              ikke endnu. Kør migration{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">030_instagram_posts.sql</code> i Supabase
              SQL Editor.
            </div>
          )}

          {/* Add URL */}
          <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-primary mb-1">Tilføj Instagram-opslag</h2>
            <p className="text-sm text-primary/60 mb-4">
              Indsæt et link til et opslag, reel eller tv-klip. Godkendte opslag vises på blog- og faktasider.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={newIgUrl}
                onChange={(e) => setNewIgUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && igSubmit(newIgUrl)}
                placeholder="https://www.instagram.com/p/..."
                className="flex-1 rounded-xl border border-primary/15 bg-primary/[0.02] px-4 py-2.5 text-sm placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
              />
              <button
                type="button"
                onClick={() => igSubmit(newIgUrl)}
                disabled={actingId === "ig-new" || !newIgUrl.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-semibold px-5 py-2.5 text-sm hover:bg-accent/90 disabled:opacity-40 transition-colors shadow-sm"
              >
                {actingId === "ig-new" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Tilføj
              </button>
            </div>
          </section>

          {/* Hashtag browser */}
          <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-primary mb-1">Find opslag via hashtags</h3>
            <p className="text-sm text-primary/60 mb-4">
              Åbn et hashtag på Instagram, find et fedt lokalt opslag, og kopier linket herover.
            </p>
            <div className="flex flex-wrap gap-2">
              {HASHTAGS.map((h) => (
                <a
                  key={h.tag}
                  href={`https://www.instagram.com/explore/tags/${h.tag}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/[0.02] px-4 py-2 text-sm text-primary/70 hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all"
                >
                  <span className="text-primary/40 group-hover:text-accent transition-colors">#</span>
                  {h.label}
                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                </a>
              ))}
            </div>
          </section>

          {/* Pending */}
          {igPending.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-bold text-primary mb-4">
                Afventer godkendelse
                <span className="ml-2 inline-flex items-center justify-center min-w-[22px] rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs font-semibold">
                  {igPending.length}
                </span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {igPending.map((p) => (
                  <div key={p.id} className="rounded-2xl border-2 border-amber-200 bg-white overflow-hidden shadow-sm">
                    <div className="p-3">
                      <IgEmbed url={p.post_url} />
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-primary/10 px-4 py-3 bg-primary/[0.02]">
                      <a
                        href={p.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary/40 hover:text-accent inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Åbn
                      </a>
                      <div className="flex gap-2">
                        <ActionButton
                          variant="approve"
                          onClick={() => igApprove(p.id)}
                          loading={actingId === p.id}
                          disabled={actingId != null}
                        />
                        <ActionButton
                          variant="reject"
                          onClick={() => igReject(p.id)}
                          loading={actingId === p.id}
                          disabled={actingId != null}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Approved */}
          {igApproved.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-bold text-primary mb-4">
                Godkendt
                <span className="ml-2 inline-flex items-center justify-center min-w-[22px] rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-xs font-semibold">
                  {igApproved.length}
                </span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {igApproved.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-emerald-200 bg-white overflow-hidden shadow-sm">
                    <div className="p-3">
                      <IgEmbed url={p.post_url} />
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-primary/10 px-4 py-3 bg-primary/[0.02]">
                      <a
                        href={p.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary/40 hover:text-accent inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Åbn
                      </a>
                      <button
                        type="button"
                        onClick={() => igRemove(p.id)}
                        disabled={actingId === p.id}
                        className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 text-sm transition-colors"
                      >
                        <Trash2 size={14} /> Fjern
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Rejected */}
          {igRejected.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-primary/50 mb-2">Afvist ({igRejected.length})</h2>
              <ul className="space-y-1 text-xs text-primary/40">
                {igRejected.map((p) => (
                  <li key={p.id} className="break-all">
                    {p.post_url.replace("https://www.instagram.com/", "")}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Empty state */}
          {!igSetupRequired && igPosts.length === 0 && !loading && (
            <EmptyState
              icon={Instagram}
              text="Ingen Instagram-opslag endnu. Tilføj et link ovenfor eller vælg et forslag."
            />
          )}
        </div>
      )}

      {/* Newsletter tab */}
      {tab === "newsletter" && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary/60">
              {nlSubs.length} tilmeldt{nlSubs.length !== 1 ? "e" : ""}
            </p>
            {nlSubs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const csv = [
                    "email,source,created_at",
                    ...nlSubs.map(
                      (s) => `${s.email},${s.source},${s.created_at}`
                    ),
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/5 px-3 py-2 text-xs font-medium text-primary/70 hover:bg-primary/10 transition-colors"
              >
                <Download size={14} />
                Eksportér CSV
              </button>
            )}
          </div>

          {nlSubs.length === 0 ? (
            <EmptyState icon={Mail} text="Ingen tilmeldinger endnu." />
          ) : (
            <div className="rounded-xl border border-primary/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/[0.03] text-left text-primary/60">
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Kilde</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Dato</th>
                    <th className="px-4 py-2.5 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {nlSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-primary/[0.02]">
                      <td className="px-4 py-3 text-primary">{sub.email}</td>
                      <td className="px-4 py-3 text-primary/50 hidden sm:table-cell">
                        <span className="inline-block rounded-md bg-primary/5 px-2 py-0.5 text-xs">
                          {sub.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-primary/50 hidden sm:table-cell">
                        {new Date(sub.created_at).toLocaleDateString("da-DK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          title="Slet"
                          onClick={async () => {
                            if (!confirm(`Slet ${sub.email}?`)) return;
                            setActingId(sub.id);
                            try {
                              const res = await fetch("/api/admin/newsletter", {
                                method: "DELETE",
                                headers: {
                                  "Content-Type": "application/json",
                                  "x-admin-secret": secret,
                                },
                                body: JSON.stringify({ id: sub.id }),
                              });
                              if (res.ok) {
                                setNlSubs((prev) => prev.filter((s) => s.id !== sub.id));
                              }
                            } finally {
                              setActingId(null);
                            }
                          }}
                          disabled={actingId === sub.id}
                          className="text-primary/30 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          {actingId === sub.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contact messages tab */}
      {tab === "contact" && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary/60">
              {unreadMsgs.length} ulæst{unreadMsgs.length !== 1 ? "e" : ""} af {contactMsgs.length} total
            </p>
          </div>

          {contactMsgs.length === 0 ? (
            <EmptyState icon={Inbox} text="Ingen beskeder endnu." />
          ) : (
            <div className="space-y-3">
              {contactMsgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    msg.status === "unread"
                      ? "border-accent/30 bg-accent/[0.03]"
                      : msg.status === "archived"
                        ? "border-primary/5 bg-primary/[0.01] opacity-60"
                        : "border-primary/10 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-primary">{msg.name}</span>
                        <a
                          href={`mailto:${msg.email}`}
                          className="text-xs text-accent hover:underline"
                        >
                          {msg.email}
                        </a>
                        <span className="inline-block rounded-md bg-primary/5 px-2 py-0.5 text-xs text-primary/50">
                          {msg.category === "fejl" ? "Fejl i data"
                            : msg.category === "forslag" ? "Forslag"
                            : msg.category === "andet" ? "Andet"
                            : "Generel"}
                        </span>
                        {msg.status === "unread" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-xs text-primary/40 mt-0.5">
                        {new Date(msg.created_at).toLocaleDateString("da-DK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {msg.status === "unread" && (
                        <button
                          type="button"
                          title="Markér som læst"
                          disabled={actingId === msg.id}
                          onClick={async () => {
                            setActingId(msg.id);
                            try {
                              const res = await fetch("/api/admin/contact", {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  "x-admin-secret": secret,
                                },
                                body: JSON.stringify({ id: msg.id, status: "read" }),
                              });
                              if (res.ok) {
                                setContactMsgs((prev) =>
                                  prev.map((m) => m.id === msg.id ? { ...m, status: "read" } : m)
                                );
                              }
                            } finally {
                              setActingId(null);
                            }
                          }}
                          className="p-1.5 text-primary/30 hover:text-accent transition-colors disabled:opacity-40"
                        >
                          {actingId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        </button>
                      )}
                      {msg.status !== "archived" && (
                        <button
                          type="button"
                          title="Arkivér"
                          disabled={actingId === msg.id}
                          onClick={async () => {
                            setActingId(msg.id);
                            try {
                              const res = await fetch("/api/admin/contact", {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  "x-admin-secret": secret,
                                },
                                body: JSON.stringify({ id: msg.id, status: "archived" }),
                              });
                              if (res.ok) {
                                setContactMsgs((prev) =>
                                  prev.map((m) => m.id === msg.id ? { ...m, status: "archived" } : m)
                                );
                              }
                            } finally {
                              setActingId(null);
                            }
                          }}
                          className="p-1.5 text-primary/30 hover:text-primary/60 transition-colors disabled:opacity-40"
                        >
                          {actingId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Slet"
                        disabled={actingId === msg.id}
                        onClick={async () => {
                          if (!confirm(`Slet besked fra ${msg.name}?`)) return;
                          setActingId(msg.id);
                          try {
                            const res = await fetch("/api/admin/contact", {
                              method: "DELETE",
                              headers: {
                                "Content-Type": "application/json",
                                "x-admin-secret": secret,
                              },
                              body: JSON.stringify({ id: msg.id }),
                            });
                            if (res.ok) {
                              setContactMsgs((prev) => prev.filter((m) => m.id !== msg.id));
                            }
                          } finally {
                            setActingId(null);
                          }
                        }}
                        className="p-1.5 text-primary/30 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {actingId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-primary/80 whitespace-pre-wrap leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indsendte shelters tab */}
      {tab === "submissions" && (
        <div className="flex flex-col gap-4">
          {loading && <div className="text-primary/60 text-sm">Henter…</div>}
          {!loading && shelterSubmissions.length === 0 && (
            <p className="text-sm text-primary/50 text-center py-10">
              Ingen indsendte shelters til behandling
            </p>
          )}
          {shelterSubmissions.map((sub) => (
            <div key={sub.id} className="border border-primary/10 rounded-xl p-4 bg-white">
              {/* Type badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      sub.type === "owner_registration"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {sub.type === "owner_registration" ? "🏠 Ejer" : "💡 Bruger-tip"}
                  </span>
                  <span className="text-xs text-primary/40">
                    {new Date(sub.created_at).toLocaleDateString("da-DK")}
                  </span>
                </div>
              </div>

              {/* Core info */}
              <div className="space-y-1 mb-3">
                <p className="font-semibold text-primary">{sub.shelter_name}</p>
                <p className="text-sm text-primary/70">📍 {sub.location_text}</p>
                {sub.capacity && (
                  <p className="text-sm text-primary/60">👥 {sub.capacity} pladser</p>
                )}
              </div>

              {/* Facilities */}
              {sub.facilities && Object.keys(sub.facilities).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(Object.entries(sub.facilities) as [string, boolean][])
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <span
                        key={k}
                        className="text-xs bg-primary/5 text-primary/70 px-2 py-0.5 rounded-full"
                      >
                        {FACILITY_LABELS[k as keyof typeof FACILITY_LABELS] ?? k}
                      </span>
                    ))}
                </div>
              )}

              {/* Description */}
              {sub.description && (
                <p className="text-sm text-primary/60 italic mb-3 line-clamp-2">{sub.description}</p>
              )}

              {/* Source info (user tip) */}
              {sub.source_info && (
                <p className="text-sm text-primary/60 mb-3">
                  <span className="font-medium">Tip:</span> {sub.source_info}
                </p>
              )}

              {/* Contact info (owner) */}
              {sub.type === "owner_registration" && (
                <div className="bg-green-50 rounded-lg px-3 py-2 mb-3 text-sm">
                  {sub.contact_name && <p className="font-medium text-primary">{sub.contact_name}</p>}
                  {sub.contact_email && (
                    <a
                      href={`mailto:${sub.contact_email}`}
                      className="text-[#2d7a4e] hover:underline"
                    >
                      {sub.contact_email}
                    </a>
                  )}
                  {sub.booking_url && (
                    <a
                      href={sub.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[#2d7a4e] hover:underline truncate mt-1"
                    >
                      {sub.booking_url}
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  disabled={actingId === sub.id}
                  onClick={async () => {
                    setActingId(sub.id);
                    await fetch("/api/admin/approve-shelter-submission", {
                      method: "POST",
                      headers: {
                        "content-type": "application/json",
                        "x-admin-secret": secret,
                      },
                      body: JSON.stringify({ submissionId: sub.id }),
                    });
                    await fetchAll(secret);
                    setActingId(null);
                  }}
                  className="flex items-center gap-1.5 bg-[#2d7a4e] text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#236040] disabled:opacity-50 transition-colors"
                >
                  <Check size={14} /> Godkend
                </button>
                <button
                  disabled={actingId === sub.id}
                  onClick={async () => {
                    const reason = prompt("Årsag til afvisning (valgfrit):") ?? "";
                    setActingId(sub.id);
                    await fetch("/api/admin/reject-shelter-submission", {
                      method: "POST",
                      headers: {
                        "content-type": "application/json",
                        "x-admin-secret": secret,
                      },
                      body: JSON.stringify({ submissionId: sub.id, reason }),
                    });
                    await fetchAll(secret);
                    setActingId(null);
                  }}
                  className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <X size={14} /> Afvis
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Oplevelser tab */}
      {tab === "oplevelser" && (
        <div className="space-y-4">
          {loading && <div className="text-primary/60 text-sm">Henter…</div>}
          {!loading && experiences.length === 0 && (
            <div className="text-primary/50 text-sm py-8 text-center">Ingen ventende oplevelser</div>
          )}
          {experiences.map((exp) => {
            const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
            return (
              <div key={exp.id} className="border border-primary/10 rounded-xl overflow-hidden">
                <div className="flex gap-4 p-4">
                  {coverUrl && (
                    <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-primary">{exp.author_name}</div>
                    <div className="text-xs text-primary/50 mb-1">{exp.shelter?.title ?? exp.shelter_id}</div>
                    <div className="text-sm text-primary/70 italic line-clamp-3">&ldquo;{exp.body}&rdquo;</div>
                    <div className="text-xs text-primary/30 mt-1">{new Date(exp.created_at).toLocaleString("da-DK")}</div>
                  </div>
                </div>
                <div className="flex border-t border-primary/10">
                  <button
                    disabled={actingId === exp.id}
                    onClick={async () => {
                      setActingId(exp.id);
                      await fetch("/api/admin/approve-experience", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                        body: JSON.stringify({ experienceId: exp.id }),
                      });
                      setActingId(null);
                      fetchAll(secret);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    <Check size={15} /> Godkend
                  </button>
                  <div className="w-px bg-primary/10" />
                  <button
                    disabled={actingId === exp.id}
                    onClick={async () => {
                      const reason = prompt("Årsag til afvisning (valgfrit):");
                      setActingId(exp.id);
                      await fetch("/api/admin/reject-experience", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                        body: JSON.stringify({ experienceId: exp.id, reason }),
                      });
                      setActingId(null);
                      fetchAll(secret);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <X size={15} /> Afvis
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  variant,
  onClick,
  loading: isLoading,
  disabled,
}: {
  variant: "approve" | "reject";
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const isApprove = variant === "approve";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors shadow-sm disabled:opacity-40 ${
        isApprove
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-white border border-primary/15 text-primary/70 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
      }`}
    >
      {isLoading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : isApprove ? (
        <Check size={15} />
      ) : (
        <X size={15} />
      )}
      {isApprove ? "Godkend" : "Afvis"}
    </button>
  );
}

function IgEmbed({ url }: { url: string }) {
  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      data-instgrm-captioned=""
      style={{
        background: "#FFF",
        border: 0,
        borderRadius: "8px",
        boxShadow: "none",
        margin: 0,
        maxWidth: "100%",
        minWidth: "200px",
        padding: 0,
        width: "100%",
      }}
    />
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Camera; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-primary/40">
      <div className="w-14 h-14 rounded-full bg-primary/[0.04] flex items-center justify-center">
        <Icon size={24} />
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
