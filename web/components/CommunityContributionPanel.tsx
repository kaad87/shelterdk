"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Droplets,
  Flame,
  Loader2,
  MessageSquare,
  ParkingCircle,
  PawPrint,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Tent,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/utils/supabase/browser";
import { trackCommunitySubmit } from "@/lib/tracking";
import {
  FACILITY_FIELDS,
  type FacilityFieldKey,
  type TriStateValue,
} from "@/lib/community";

/* ── Icon map for facility chips ─────────────────────────────── */
const FACILITY_ICONS: Record<string, React.ReactNode> = {
  vand: <Droplets size={14} />,
  toilet: <span className="text-sm">🚽</span>,
  parkering: <ParkingCircle size={14} />,
  baalplads: <Flame size={14} />,
  hund: <PawPrint size={14} />,
  legeplads: <Puzzle size={14} />,
  teltplads: <Tent size={14} />,
};

/* ── Quick‑chip subset (most useful for visitors) ────────────── */
const QUICK_CHIPS: { key: FacilityFieldKey; label: string }[] = [
  { key: "vand", label: "Vand?" },
  { key: "toilet", label: "Toilet?" },
  { key: "parkering", label: "Parkering?" },
  { key: "baalplads", label: "Bålplads?" },
  { key: "hund", label: "Hund tilladt?" },
  { key: "legeplads", label: "Legeplads?" },
];

type AuthState = {
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
};

interface CommunityContributionPanelProps {
  slug: string;
}

export function CommunityContributionPanel({
  slug,
}: CommunityContributionPanelProps) {
  /* ── auth ─────────────────────────────────────────────────── */
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    userEmail: null,
    userName: null,
  });
  const [loadingAuth, setLoadingAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();
    setLoadingAuth(true);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        setAuth({
          accessToken: session?.access_token ?? null,
          userEmail: session?.user?.email ?? null,
          userName:
            (session?.user?.user_metadata?.full_name as string | undefined) ??
            (session?.user?.user_metadata?.name as string | undefined) ??
            null,
        });
      })
      .finally(() => mounted && setLoadingAuth(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({
        accessToken: session?.access_token ?? null,
        userEmail: session?.user?.email ?? null,
        userName:
          (session?.user?.user_metadata?.full_name as string | undefined) ??
          (session?.user?.user_metadata?.name as string | undefined) ??
          null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ── facility quick‑chip state ───────────────────────────── */
  const [activeFacility, setActiveFacility] = useState<FacilityFieldKey | null>(
    null
  );
  const [sendingFacility, setSendingFacility] = useState(false);
  const [facilityMessage, setFacilityMessage] = useState<string | null>(null);

  /* ── tip (comment) state ─────────────────────────────────── */
  const [showTipForm, setShowTipForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);

  /* ── photo state ─────────────────────────────────────────── */
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  /* pre-fill name/email from auth */
  useEffect(() => {
    if (auth.userName) setName((p) => p || auth.userName || "");
    if (auth.userEmail) setEmail((p) => p || auth.userEmail || "");
  }, [auth]);

  /* ── handlers ────────────────────────────────────────────── */

  async function handleFacilityChip(key: FacilityFieldKey, value: TriStateValue) {
    setFacilityMessage(null);
    setSendingFacility(true);
    try {
      const res = await fetch(`/api/shelter/${slug}/submit-facilities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken
            ? { Authorization: `Bearer ${auth.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          name: auth.userName || "Anonym",
          email: auth.userEmail || null,
          facilities: { [key]: value },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFacilityMessage(data.error || "Kunne ikke sende.");
        return;
      }
      setFacilityMessage("Tak! Sendt til godkendelse.");
      setActiveFacility(null);
      trackCommunitySubmit("facilities");
    } catch {
      setFacilityMessage("Kunne ikke sende. Prøv igen.");
    } finally {
      setSendingFacility(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentMessage(null);
    if (!name.trim() || !commentText.trim()) {
      setCommentMessage("Skriv navn og tip.");
      return;
    }
    setSendingComment(true);
    try {
      const res = await fetch(`/api/shelter/${slug}/submit-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken
            ? { Authorization: `Bearer ${auth.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          text: commentText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentMessage(data.error || "Kunne ikke sende tip.");
        return;
      }
      setCommentText("");
      setCommentMessage(data.message || "Tak! Dit tip er sendt til godkendelse.");
      trackCommunitySubmit("comment");
    } catch {
      setCommentMessage("Kunne ikke sende tip. Prøv igen.");
    } finally {
      setSendingComment(false);
    }
  }

  async function handleSubmitPhoto(e: React.FormEvent) {
    e.preventDefault();
    setPhotoMessage(null);
    if (!photoFile) {
      setPhotoMessage("Vælg et billede først.");
      return;
    }
    setSendingPhoto(true);
    try {
      const formData = new FormData();
      formData.set("file", photoFile);
      if (email.trim()) formData.set("email", email.trim());
      const res = await fetch(`/api/shelter/${slug}/upload-photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoMessage(data.error || "Kunne ikke sende billede.");
        return;
      }
      setPhotoFile(null);
      setPhotoMessage(data.message || "Tak! Billedet er sendt til godkendelse.");
      trackCommunitySubmit("photo");
    } catch {
      setPhotoMessage("Kunne ikke sende billede. Prøv igen.");
    } finally {
      setSendingPhoto(false);
    }
  }

  /* ── render ──────────────────────────────────────────────── */

  return (
    <section className="rounded-2xl border border-primary/10 bg-white shadow-sm p-4 sm:p-5 mb-10">
      <h3 className="text-sm font-medium text-primary/60 mb-3">Hjælp os med at opdatere info</h3>
      {/* ── Quick‑action chips ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() =>
              setActiveFacility((prev) =>
                prev === chip.key ? null : chip.key
              )
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              activeFacility === chip.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-primary/15 bg-white text-primary/70 hover:border-primary/30 hover:text-primary"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2`}
          >
            {FACILITY_ICONS[chip.key] || null}
            {chip.label}
          </button>
        ))}

        {/* Skriv et tip */}
        <button
          type="button"
          onClick={() => {
            setShowTipForm((v) => !v);
            setShowPhotoForm(false);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            showTipForm
              ? "border-accent bg-accent/10 text-accent"
              : "border-primary/15 bg-white text-primary/70 hover:border-primary/30 hover:text-primary"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2`}
        >
          <MessageSquare size={14} />
          Skriv et tip
        </button>

        {/* Billede */}
        <button
          type="button"
          onClick={() => {
            setShowPhotoForm((v) => !v);
            setShowTipForm(false);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            showPhotoForm
              ? "border-accent bg-accent/10 text-accent"
              : "border-primary/15 bg-white text-primary/70 hover:border-primary/30 hover:text-primary"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2`}
        >
          <Camera size={14} />
          Billede
        </button>
      </div>

      {/* Disclaimer */}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-primary/60">
        <ShieldCheck size={12} />
        Alle bidrag gennemgås af admin inden de vises
      </p>

      {/* ── Facility confirm popover ───────────────────────── */}
      {activeFacility && (
        <div className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3">
          <p className="text-sm text-primary/80 mb-2">
            Er der{" "}
            <strong>
              {QUICK_CHIPS.find((c) => c.key === activeFacility)?.label.replace(
                "?",
                ""
              )}
            </strong>{" "}
            ved dette shelter?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={sendingFacility}
              onClick={() => handleFacilityChip(activeFacility, "yes")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2"
            >
              {sendingFacility ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Ja
            </button>
            <button
              type="button"
              disabled={sendingFacility}
              onClick={() => handleFacilityChip(activeFacility, "no")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2"
            >
              {sendingFacility ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
              Nej
            </button>
            <button
              type="button"
              onClick={() => setActiveFacility(null)}
              className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
            >
              Annuller
            </button>
          </div>
          {facilityMessage && (
            <p role="status" className="mt-2 text-sm text-primary/80">{facilityMessage}</p>
          )}
        </div>
      )}

      {/* ── Tip form ───────────────────────────────────────── */}
      {showTipForm && (
        <form
          onSubmit={handleSubmitComment}
          className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3 space-y-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dit navn"
            aria-label="Dit navn"
            className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40"
          />
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Fx: God plads til 2 familier, husk myggespray."
            aria-label="Dit tip"
            className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={sendingComment}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-dark px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
            >
              {sendingComment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageSquare size={14} />
              )}
              Send tip
            </button>
            <button
              type="button"
              onClick={() => setShowTipForm(false)}
              className="text-sm text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md"
            >
              Annuller
            </button>
          </div>
          {commentMessage && (
            <p role="status" className="text-sm text-primary/80">{commentMessage}</p>
          )}
        </form>
      )}

      {/* ── Photo form ─────────────────────────────────────── */}
      {showPhotoForm && (
        <form
          onSubmit={handleSubmitPhoto}
          className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3 space-y-2"
        >
          <p className="text-xs text-primary/60">
            JPEG, PNG eller WebP (max 5 MB)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary cursor-pointer hover:bg-primary/5 focus-within:ring-2 focus-within:ring-accent/50 focus-within:ring-offset-2">
              <Camera size={14} className="text-accent" />
              Vælg billede
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Vælg billede"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-xs text-primary/60">
              {photoFile ? photoFile.name : "Ingen fil valgt"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={sendingPhoto || !photoFile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-dark px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
            >
              {sendingPhoto ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
              Send billede
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoForm(false)}
              className="text-sm text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md"
            >
              Annuller
            </button>
          </div>
          {photoMessage && (
            <p role="status" className="text-sm text-primary/80">{photoMessage}</p>
          )}
        </form>
      )}
    </section>
  );
}
