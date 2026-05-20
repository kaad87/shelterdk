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
  BookOpen,
  Star,
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

export type TabKey =
  | "photos"
  | "community"
  | "instagram"
  | "newsletter"
  | "contact"
  | "oplevelser"
  | "submissions"
  | "bookinger";
export type AdminSummaryCounts = Record<
  "photos" | "community" | "instagram" | "newsletter" | "contact" | "oplevelser" | "submissions" | "bookinger" | "bookingMonitor",
  number
>;

type BookableShelterAdmin = {
  id: string;
  slug: string;
  title: string;
  owner_email: string;
  owner_token: string;
  max_persons: number;
  description: string | null;
  booking_mode: "shelterdk" | "iframe" | "both";
  created_at: string;
};

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

const MODERATION_TABS: { key: TabKey; label: string; icon: typeof Camera }[] = [
  { key: "photos", label: "Billeder", icon: Camera },
  { key: "community", label: "Community", icon: MessageSquare },
  { key: "oplevelser", label: "Oplevelser", icon: Star },
  { key: "submissions", label: "Indsendte", icon: Plus },
  { key: "contact", label: "Beskeder", icon: Inbox },
];

const MANAGEMENT_TABS: { key: TabKey; label: string; icon: typeof Camera }[] = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "newsletter", label: "Nyhedsbrev", icon: Mail },
  { key: "bookinger", label: "Bookinger", icon: BookOpen },
];

type AdminPhotoReviewProps = {
  initialTab?: TabKey;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  showManagementTabs?: boolean;
  showModerationTabs?: boolean;
  onSecretChange?: (secret: string | null) => void;
  onSummaryChange?: (summary: AdminSummaryCounts) => void;
};

const EMPTY_SUMMARY: AdminSummaryCounts = {
  photos: 0,
  community: 0,
  instagram: 0,
  newsletter: 0,
  contact: 0,
  oplevelser: 0,
  submissions: 0,
  bookinger: 0,
  bookingMonitor: 0,
};

export function AdminPhotoReview({
  initialTab = "photos",
  activeTab,
  onTabChange,
  showManagementTabs = true,
  showModerationTabs = true,
  onSecretChange,
  onSummaryChange,
}: AdminPhotoReviewProps) {
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [newIgUrl, setNewIgUrl] = useState("");
  const [igScriptReady, setIgScriptReady] = useState(false);
  const embedRef = useRef(0);
  const currentTab = activeTab ?? tab;
  const selectTab = (next: TabKey) => {
    if (activeTab === undefined) setTab(next);
    onTabChange?.(next);
  };

  // Bookinger tab
  const [bookableShelters, setBookableShelters] = useState<BookableShelterAdmin[]>([]);
  const [shelterForm, setShelterForm] = useState({ slug: "", title: "", owner_email: "", max_persons: "6", description: "", shelter_id: "", booking_mode: "shelterdk" as "shelterdk" | "iframe" | "both", payment_mode: "after_confirmation" as "after_confirmation" | "upfront", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25" });
  const [shelterCreating, setShelterCreating] = useState(false);
  const [shelterCreateError, setShelterCreateError] = useState<string | null>(null);
  // Shelter search
  const [shelterSearch, setShelterSearch] = useState("");
  const [shelterSearchResults, setShelterSearchResults] = useState<{ id: string; title: string; slug: string; kommune: string | null; region: string | null }[]>([]);
  const [shelterSearchLoading, setShelterSearchLoading] = useState(false);
  const [shelterSearchOpen, setShelterSearchOpen] = useState(false);

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
    if (stored) {
      setSecret(stored);
      onSecretChange?.(stored);
    }
  }, [onSecretChange]);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  const publishSummary = useCallback(
    (counts: AdminSummaryCounts) => {
      onSummaryChange?.(counts);
    },
    [onSummaryChange]
  );

  const fetchAll = useCallback(async (s: string) => {
    setLoading(true);
    setError("");
    try {
      const ts = Date.now();
      const [photoRes, communityRes, igRes, nlRes, contactRes, experiencesRes, submissionsRes, sheltersRes, bookingMonitorRes] = await Promise.all([
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
        fetch(`/api/admin/shelters?t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
        fetch(`/api/admin/booking-monitor?status=open&limit=200&t=${ts}`, {
          headers: { "x-admin-secret": s },
          cache: "no-store",
        }),
      ]);
      if (
        photoRes.status === 401 ||
        communityRes.status === 401 ||
        igRes.status === 401 ||
        nlRes.status === 401 ||
        contactRes.status === 401 ||
        experiencesRes.status === 401 ||
        submissionsRes.status === 401 ||
        sheltersRes.status === 401 ||
        bookingMonitorRes.status === 401
      ) {
        setError("Ugyldig kode");
        sessionStorage.removeItem(STORAGE_KEY);
        setSecret("");
        onSecretChange?.(null);
        setSubmissions([]);
        setCommunitySubmissions([]);
        setIgPosts([]);
        setNlSubs([]);
        setContactMsgs([]);
        setExperiences([]);
        setShelterSubmissions([]);
        setBookableShelters([]);
        setLastUpdatedAt(null);
        publishSummary(EMPTY_SUMMARY);
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
      const nextSubmissions = photoData.submissions ?? [];
      const nextCommunitySubmissions = communityData.submissions ?? [];
      setSubmissions(nextSubmissions);
      setCommunitySubmissions(nextCommunitySubmissions);

      let nextIgPosts: IgPost[] = [];
      if (igRes.ok) {
        const igData = await igRes.json();
        if (igData.setupRequired) {
          setIgSetupRequired(true);
          setIgPosts([]);
        } else {
          setIgSetupRequired(false);
          nextIgPosts = igData.posts ?? [];
          setIgPosts(nextIgPosts);
        }
      }

      let nextNlSubs: NewsletterSub[] = [];
      if (nlRes.ok) {
        const nlData = await nlRes.json();
        nextNlSubs = nlData.subscribers ?? [];
        setNlSubs(nextNlSubs);
      }

      let nextContactMsgs: ContactMessage[] = [];
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        nextContactMsgs = contactData.messages ?? [];
        setContactMsgs(nextContactMsgs);
      }

      let nextExperiences: Experience[] = [];
      if (experiencesRes.ok) {
        const expData = await experiencesRes.json();
        nextExperiences = expData.experiences ?? [];
        setExperiences(nextExperiences);
      }

      let nextShelterSubmissions: ShelterSubmission[] = [];
      if (submissionsRes.ok) {
        const subsData = await submissionsRes.json();
        nextShelterSubmissions = subsData.submissions ?? [];
        setShelterSubmissions(nextShelterSubmissions);
      }

      let nextBookableShelters: BookableShelterAdmin[] = [];
      if (sheltersRes.ok) {
        const sheltersData = await sheltersRes.json();
        nextBookableShelters = sheltersData.shelters ?? [];
        setBookableShelters(nextBookableShelters);
      }

      let nextBookingMonitorCount = 0;
      if (bookingMonitorRes.ok) {
        const bookingMonitorData = await bookingMonitorRes.json();
        nextBookingMonitorCount = Array.isArray(bookingMonitorData) ? bookingMonitorData.length : 0;
      }

      const nextSummary: AdminSummaryCounts = {
        photos: nextSubmissions.length,
        community: nextCommunitySubmissions.length,
        instagram: nextIgPosts.filter((p) => p.status === "pending").length,
        newsletter: nextNlSubs.length,
        contact: nextContactMsgs.filter((m) => m.status === "unread").length,
        oplevelser: nextExperiences.length,
        submissions: nextShelterSubmissions.length,
        bookinger: nextBookableShelters.length,
        bookingMonitor: nextBookingMonitorCount,
      };

      publishSummary(nextSummary);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [onSecretChange, publishSummary]);

  useEffect(() => {
    if (secret) {
      sessionStorage.setItem(STORAGE_KEY, secret);
      onSecretChange?.(secret);
      fetchAll(secret);
    } else {
      setSubmissions([]);
      setCommunitySubmissions([]);
      setIgPosts([]);
      setNlSubs([]);
      setContactMsgs([]);
      setExperiences([]);
      setShelterSubmissions([]);
      setBookableShelters([]);
      setLastUpdatedAt(null);
      publishSummary(EMPTY_SUMMARY);
    }
  }, [secret, fetchAll, onSecretChange, publishSummary]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const s = inputSecret.trim();
    if (!s) return;
    setSecret(s);
    onSecretChange?.(s);
    setInputSecret("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSecret("");
    onSecretChange?.(null);
    setInputSecret("");
    setSubmissions([]);
    setCommunitySubmissions([]);
    setIgPosts([]);
    setNlSubs([]);
    setContactMsgs([]);
    setExperiences([]);
    setShelterSubmissions([]);
    setBookableShelters([]);
    setLastUpdatedAt(null);
    publishSummary(EMPTY_SUMMARY);
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
    bookinger: bookableShelters.length,
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
          <h1 className="font-serif text-2xl font-bold text-primary">Indhold & drift</h1>
          <p className="text-sm text-primary/60 mt-1">
            {showManagementTabs
              ? "Godkend bidrag, kurater Instagram og administrér bookinger."
              : "Arbejdskø for moderation, indsendelser og beskeder."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdatedAt && (
            <p className="hidden text-xs text-primary/45 sm:block">
              Sidst opdateret {new Date(lastUpdatedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
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
      {(showModerationTabs || showManagementTabs) && (
      <div className="mb-6 flex items-center gap-0.5 rounded-xl border border-primary/10 bg-primary/[0.02] p-1.5 overflow-x-auto">
        {showModerationTabs && MODERATION_TABS.map(({ key, label, icon: Icon }) => {
          const count = badgeCounts[key];
          const isActive = currentTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all shrink-0 ${
                isActive
                  ? "bg-white text-primary shadow-sm"
                  : "text-primary/55 hover:text-primary/80 hover:bg-white/50"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {count > 0 && (
                <span
                  className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                    isActive ? "bg-accent text-white" : "bg-primary/10 text-primary/60"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {showManagementTabs && (
          <>
            {showModerationTabs && <div className="w-px h-5 bg-primary/20 mx-1 shrink-0" />}
            {MANAGEMENT_TABS.map(({ key, label, icon: Icon }) => {
              const count = badgeCounts[key];
              const isActive = currentTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectTab(key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all shrink-0 ${
                    isActive
                      ? "bg-white text-primary shadow-sm"
                      : "text-primary/55 hover:text-primary/80 hover:bg-white/50"
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                  {count > 0 && (
                    <span
                      className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                        isActive ? "bg-accent text-white" : "bg-primary/10 text-primary/60"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
      )}

      {/* Loading state */}
      {loading && submissions.length === 0 && communitySubmissions.length === 0 && igPosts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-primary/50">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Henter data…</p>
        </div>
      )}

      {/* Photos tab */}
      {currentTab === "photos" && !loading && (
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
      {currentTab === "community" && !loading && (
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
      {currentTab === "instagram" && !loading && (
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
      {currentTab === "newsletter" && !loading && (
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
      {currentTab === "contact" && !loading && (
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
      {currentTab === "submissions" && (
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
      {currentTab === "oplevelser" && (
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

      {/* ── BOOKINGER TAB ── */}
      {currentTab === "bookinger" && (
        <div className="space-y-8">
          {/* Create form */}
          <section className="rounded-2xl border border-primary/10 bg-white p-6">
            <h2 className="font-serif text-lg font-bold text-primary mb-1">Opret nyt bookbart shelter</h2>
            <p className="text-xs text-primary/40 mb-5">Søg efter shelteret i databasen for at linke det korrekt, eller udfyld manuelt.</p>

            {/* Shelter search */}
            <div className="mb-5 relative">
              <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">
                Søg shelter i ShelterDK-databasen
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shelterSearch}
                  onChange={async (e) => {
                    const q = e.target.value;
                    setShelterSearch(q);
                    setShelterSearchOpen(true);
                    if (q.length < 2) { setShelterSearchResults([]); return; }
                    setShelterSearchLoading(true);
                    const res = await fetch(`/api/admin/search-shelters?q=${encodeURIComponent(q)}`, {
                      headers: { "x-admin-secret": secret },
                    });
                    const data = await res.json();
                    setShelterSearchResults(data.shelters ?? []);
                    setShelterSearchLoading(false);
                  }}
                  onFocus={() => setShelterSearchOpen(true)}
                  placeholder="Skriv shelternavn…"
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {shelterSearchLoading && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 size={14} className="animate-spin text-primary/30" />
                  </div>
                )}
              </div>
              {shelterSearchOpen && shelterSearchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-primary/15 bg-white shadow-lg overflow-hidden">
                  {shelterSearchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShelterForm((f) => ({
                          ...f,
                          title: s.title,
                          slug: s.slug,
                          shelter_id: s.id,
                        }));
                        setShelterSearch(s.title);
                        setShelterSearchOpen(false);
                        setShelterSearchResults([]);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent/5 transition-colors border-b border-primary/5 last:border-0"
                    >
                      <p className="text-sm font-medium text-primary">{s.title}</p>
                      <p className="text-xs text-primary/40">{[s.kommune, s.region].filter(Boolean).join(", ")}</p>
                    </button>
                  ))}
                </div>
              )}
              {shelterForm.shelter_id && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <Check size={12} /> Linket til shelter i databasen
                </p>
              )}
            </div>

            <div className="border-t border-primary/8 pt-5">
              <p className="text-xs text-primary/35 mb-4">Udfyld eller juster detaljerne:</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setShelterCreating(true);
                  setShelterCreateError(null);
                  const res = await fetch("/api/admin/shelters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                    body: JSON.stringify({
                      ...shelterForm,
                      max_persons: Number(shelterForm.max_persons),
                      shelter_id: shelterForm.shelter_id || null,
                      booking_mode: shelterForm.booking_mode,
                      payment_mode: shelterForm.payment_mode,
                      shelter_price_dkk: shelterForm.shelter_price_dkk || null,
                      platform_fee_pct: shelterForm.platform_fee_pct,
                      platform_fee_min_dkk: shelterForm.platform_fee_min_dkk,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setShelterCreateError(data.error); setShelterCreating(false); return; }
                  setShelterForm({ slug: "", title: "", owner_email: "", max_persons: "6", description: "", shelter_id: "", booking_mode: "shelterdk", payment_mode: "after_confirmation" as "after_confirmation" | "upfront", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25" });
                  setShelterSearch("");
                  setShelterCreating(false);
                  fetchAll(secret);
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Titel *</label>
                  <input required value={shelterForm.title}
                    onChange={(e) => setShelterForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Skovly Shelter"
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">
                    Slug * <span className="font-normal normal-case text-primary/30">(URL: /book/slug)</span>
                  </label>
                  <input required value={shelterForm.slug}
                    onChange={(e) => setShelterForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), shelter_id: "" }))}
                    placeholder="skovly-shelter"
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Ejer-email *</label>
                  <input required type="email" value={shelterForm.owner_email}
                    onChange={(e) => setShelterForm((f) => ({ ...f, owner_email: e.target.value }))}
                    placeholder="ejer@shelter.dk"
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Maks personer</label>
                  <input required type="number" min={1} max={50} value={shelterForm.max_persons}
                    onChange={(e) => setShelterForm((f) => ({ ...f, max_persons: e.target.value }))}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-2">Bookingkanaler * <span className="font-normal normal-case text-primary/30">(vælg én eller begge)</span></label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      { key: "shelterdk", label: "ShelterDK", desc: "shelterdk.dk/book/[slug] — til shelters uden egen hjemmeside" },
                      { key: "iframe", label: "Iframe / embed", desc: "Ejeren embedder en iframe på sin egen hjemmeside" },
                    ] as const).map(({ key, label, desc }) => {
                      const checked = shelterForm.booking_mode === key || shelterForm.booking_mode === "both";
                      const toggle = () => setShelterForm((f) => {
                        const cur = f.booking_mode;
                        if (key === "shelterdk") {
                          if (cur === "both") return { ...f, booking_mode: "iframe" };
                          if (cur === "iframe") return { ...f, booking_mode: "both" };
                          return f; // already shelterdk, can't uncheck last one
                        } else {
                          if (cur === "both") return { ...f, booking_mode: "shelterdk" };
                          if (cur === "shelterdk") return { ...f, booking_mode: "both" };
                          return f; // already iframe, can't uncheck last one
                        }
                      });
                      return (
                        <button key={key} type="button" onClick={toggle}
                          className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${checked ? "border-accent bg-accent/[0.04]" : "border-primary/15 hover:border-primary/30"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 ${checked ? "border-accent bg-accent" : "border-primary/30"}`}>
                              {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className="text-sm font-semibold text-primary">{label}</span>
                          </div>
                          <p className="text-xs text-primary/45 pl-5 leading-relaxed">{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Betalingsmodel *</label>
                  <select
                    value={shelterForm.payment_mode}
                    onChange={(e) => setShelterForm((f) => ({ ...f, payment_mode: e.target.value as "after_confirmation" | "upfront" }))}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="after_confirmation">Betal efter accept (standard)</option>
                    <option value="upfront">Betal ved booking (forudbetaling)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">
                    Pris pr. nat (kr) <span className="font-normal normal-case text-primary/30">— tom = gratis/aftales</span>
                  </label>
                  <p className="text-[11px] text-primary/40 mb-1.5">
                    Gæstens bruttopris pr. nat.
                  </p>
                  <input
                    type="number" min={0} value={shelterForm.shelter_price_dkk}
                    onChange={(e) => setShelterForm((f) => ({ ...f, shelter_price_dkk: e.target.value }))}
                    placeholder="f.eks. 200"
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">
                    Transaktionsgebyr % <span className="font-normal normal-case text-primary/30">— standard 5%</span>
                  </label>
                  <p className="text-[11px] text-primary/40 mb-1.5">
                    Brutto-gebyr inkl. moms.
                  </p>
                  <input
                    type="number" min={0} max={100} step={0.5} value={shelterForm.platform_fee_pct}
                    onChange={(e) => setShelterForm((f) => ({ ...f, platform_fee_pct: e.target.value }))}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">
                    Minimumsgebyr (kr) <span className="font-normal normal-case text-primary/30">— standard 25 kr</span>
                  </label>
                  <p className="text-[11px] text-primary/40 mb-1.5">
                    Brutto inkl. moms. 50 kr svarer til 40 kr netto.
                  </p>
                  <input
                    type="number" min={0} value={shelterForm.platform_fee_min_dkk}
                    onChange={(e) => setShelterForm((f) => ({ ...f, platform_fee_min_dkk: e.target.value }))}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1">Beskrivelse <span className="font-normal normal-case text-primary/30">(valgfri)</span></label>
                  <textarea rows={2} value={shelterForm.description}
                    onChange={(e) => setShelterForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                  />
                </div>
                {shelterCreateError && (
                  <div className="sm:col-span-2">
                    <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{shelterCreateError}</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <button type="submit" disabled={shelterCreating}
                    className="rounded-lg bg-accent text-white px-5 py-2 text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                    {shelterCreating ? "Opretter…" : "Opret shelter"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Shelter list */}
          <section>
            <h2 className="font-serif text-lg font-bold text-primary mb-3">
              Bookbare shelters ({loading ? "…" : bookableShelters.length})
            </h2>
            {loading && <div className="text-primary/50 text-sm">Henter…</div>}
            {!loading && bookableShelters.length === 0 && (
              <p className="text-primary/40 text-sm">Ingen bookbare shelters endnu.</p>
            )}
            <div className="space-y-3">
              {bookableShelters.map((s) => {
                const origin = typeof window !== "undefined" ? window.location.origin : "https://shelterdk.dk";
                const mode = s.booking_mode ?? "iframe";
                const shelterDkUrl = `${origin}/book/${s.slug}`;
                const embedUrl = `${origin}/embed/book/${s.slug}`;
                const dashboardUrl = `${origin}/owner/${s.owner_token}`;
                const embedCode = (mode === "iframe" || mode === "both")
                  ? `<iframe src="${embedUrl}" width="100%" height="700" frameborder="0" style="border:0;border-radius:12px" loading="lazy" title="Shelter booking leveret af ShelterDK" allowfullscreen></iframe>\n<a href="https://shelterdk.dk" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a>`
                  : null;
                return (
                  <div key={s.id} className="rounded-xl border border-primary/10 bg-white p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-primary text-sm">{s.title}</p>
                          {(mode === "shelterdk" || mode === "both") && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-accent/10 text-accent">ShelterDK</span>
                          )}
                          {(mode === "iframe" || mode === "both") && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-primary/8 text-primary/50">Iframe</span>
                          )}
                        </div>
                        <p className="text-xs text-primary/50">{s.owner_email} · maks {s.max_persons} pers.</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Slet "${s.title}"? Dette fjerner også alle bookings.`)) return;
                          await fetch("/api/admin/shelters", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                            body: JSON.stringify({ id: s.id }),
                          });
                          fetchAll(secret);
                        }}
                        className="text-xs text-red-400 hover:text-red-600 shrink-0"
                      >
                        Slet
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        ...(mode === "shelterdk" || mode === "both" ? [{ label: "Bookingside", value: shelterDkUrl }] : []),
                        ...(mode === "iframe" || mode === "both" ? [{ label: "Embed-URL", value: embedUrl }] : []),
                        { label: "Dashboard", value: dashboardUrl },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-xs text-primary/35 w-24 shrink-0">{label}</span>
                          <code className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded flex-1 truncate">{value}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(value)}
                            className="text-xs px-2 py-0.5 rounded border border-primary/15 hover:bg-primary/5 transition-colors shrink-0 text-primary/50"
                          >
                            Kopiér
                          </button>
                        </div>
                      ))}
                      {embedCode && (
                        <div className="mt-2 pt-2 border-t border-primary/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-primary/35">Embed-kode</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(embedCode)}
                              className="text-xs px-2 py-0.5 rounded border border-primary/15 hover:bg-primary/5 transition-colors text-primary/50"
                            >
                              Kopiér kode
                            </button>
                          </div>
                          <pre className="text-[10px] text-primary/40 bg-primary/[0.03] rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{embedCode}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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
