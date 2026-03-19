"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronDown, Loader2, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { createBrowserSupabaseClient } from "@/utils/supabase/browser";
import { FACILITY_FIELDS, type FacilityFieldKey, type TriStateValue } from "@/lib/community";

type AuthState = {
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
};

interface CommunityContributionPanelProps {
  slug: string;
}

const TRI_STATE_OPTIONS: { value: TriStateValue; label: string }[] = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nej" },
  { value: "unknown", label: "Ved ikke" },
];

export function CommunityContributionPanel({ slug }: CommunityContributionPanelProps) {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    userEmail: null,
    userName: null,
  });
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);

  const [facilities, setFacilities] = useState<Partial<Record<FacilityFieldKey, TriStateValue>>>({});
  const [sendingFacilities, setSendingFacilities] = useState(false);
  const [facilitiesMessage, setFacilitiesMessage] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  const hasAnyFacilityValue = useMemo(
    () => FACILITY_FIELDS.some((f) => facilities[f.key] != null),
    [facilities]
  );

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();
    setLoadingAuth(true);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        const nextAuth: AuthState = {
          accessToken: session?.access_token ?? null,
          userEmail: session?.user?.email ?? null,
          userName:
            (session?.user?.user_metadata?.full_name as string | undefined) ??
            (session?.user?.user_metadata?.name as string | undefined) ??
            null,
        };
        setAuth(nextAuth);
        if (nextAuth.userName) setName((prev) => prev || nextAuth.userName || "");
        if (nextAuth.userEmail) setEmail((prev) => prev || nextAuth.userEmail || "");
      })
      .finally(() => mounted && setLoadingAuth(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextAuth: AuthState = {
        accessToken: session?.access_token ?? null,
        userEmail: session?.user?.email ?? null,
        userName:
          (session?.user?.user_metadata?.full_name as string | undefined) ??
          (session?.user?.user_metadata?.name as string | undefined) ??
          null,
      };
      setAuth(nextAuth);
      if (nextAuth.userName) setName((prev) => prev || nextAuth.userName || "");
      if (nextAuth.userEmail) setEmail((prev) => prev || nextAuth.userEmail || "");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
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
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
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
    } catch {
      setCommentMessage("Kunne ikke sende tip. Prøv igen.");
    } finally {
      setSendingComment(false);
    }
  }

  async function handleSubmitFacilities(e: React.FormEvent) {
    e.preventDefault();
    setFacilitiesMessage(null);
    if (!name.trim()) {
      setFacilitiesMessage("Skriv dit navn.");
      return;
    }
    if (!hasAnyFacilityValue) {
      setFacilitiesMessage("Vælg mindst en facilitet.");
      return;
    }

    setSendingFacilities(true);
    try {
      const res = await fetch(`/api/shelter/${slug}/submit-facilities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          facilities,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFacilitiesMessage(data.error || "Kunne ikke sende facilitetsforslag.");
        return;
      }
      setFacilities({});
      setFacilitiesMessage(
        data.message || "Tak! Dine oplysninger er sendt til godkendelse."
      );
    } catch {
      setFacilitiesMessage("Kunne ikke sende facilitetsforslag. Prøv igen.");
    } finally {
      setSendingFacilities(false);
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
    } catch {
      setPhotoMessage("Kunne ikke sende billede. Prøv igen.");
    } finally {
      setSendingPhoto(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/10 bg-white shadow-sm p-5 sm:p-6 mb-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="font-serif text-xl font-bold text-primary mb-1">
            Hjælp os med at forbedre oplysningerne
          </h2>
          <p className="text-sm text-primary/75">
            Del et tip eller opdater faciliteter
          </p>
        </div>
        <ChevronDown
          size={20}
          className={`text-primary/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="mt-3 flex items-center gap-2 text-xs text-primary/65">
            <ShieldCheck size={14} className="text-accent" />
            Godkendelse kræves altid
          </div>

          <div className="mt-4 rounded-xl bg-primary/[0.03] border border-primary/10 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-primary/80">
                {auth.userEmail ? (
                  <>Logget ind som <strong>{auth.userEmail}</strong></>
                ) : (
                  <>Log ind med Google for hurtigere bidrag (valgfrit)</>
                )}
              </div>
              {!auth.userEmail && (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={loadingAuth}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  {loadingAuth ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} className="text-accent" />
                  )}
                  Fortsæt med Google
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleSubmitComment} className="rounded-xl border border-primary/10 p-4">
              <h3 className="font-semibold text-primary mb-3">Del et tip</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dit navn (vises offentligt)"
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-primary"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail (valgfri)"
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-primary"
                />
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Fx: God plads til 2 familier, men husk myggespray."
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-primary min-h-[120px]"
                />
                <button
                  type="submit"
                  disabled={sendingComment}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {sendingComment ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                  Send tip
                </button>
                {commentMessage && <p className="text-sm text-primary/80">{commentMessage}</p>}
              </div>
            </form>

            <form
              onSubmit={handleSubmitFacilities}
              className="rounded-xl border border-primary/10 p-4"
            >
              <h3 className="font-semibold text-primary mb-3">Opdater faciliteter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FACILITY_FIELDS.map((field) => (
                  <label key={field.key} className="text-sm text-primary/85">
                    <span className="block mb-1">{field.label}</span>
                    <select
                      value={facilities[field.key] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value as TriStateValue | "";
                        setFacilities((prev) => {
                          const next = { ...prev };
                          if (!value) delete next[field.key];
                          else next[field.key] = value;
                          return next;
                        });
                      }}
                      className="w-full min-w-0 rounded-lg border border-primary/20 px-2 py-2 text-sm text-primary bg-white"
                    >
                      <option value="">Ikke sat</option>
                      {TRI_STATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="mt-3 space-y-3">
                <button
                  type="submit"
                  disabled={sendingFacilities}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendingFacilities ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Send facilitetsforslag
                </button>
                {facilitiesMessage && <p className="text-sm text-primary/80">{facilitiesMessage}</p>}
              </div>
            </form>
          </div>

          <form onSubmit={handleSubmitPhoto} className="mt-6 rounded-xl border border-primary/10 p-4">
            <h3 className="font-semibold text-primary mb-3">Upload billede fra shelteret</h3>
            <p className="text-sm text-primary/70 mb-3">
              JPEG, PNG eller WebP (max 5 MB). Billedet vises først efter godkendelse.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary cursor-pointer hover:bg-primary/5">
                <Camera size={15} className="text-accent" />
                Vælg billede
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <span className="text-sm text-primary/70">
                {photoFile ? photoFile.name : "Ingen fil valgt"}
              </span>
              <button
                type="submit"
                disabled={sendingPhoto || !photoFile}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {sendingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                Send billede
              </button>
            </div>
            {photoMessage && <p className="mt-3 text-sm text-primary/80">{photoMessage}</p>}
          </form>
        </>
      )}
    </section>
  );
}
