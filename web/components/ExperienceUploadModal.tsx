"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, ChevronRight, Copy, Check } from "lucide-react";

interface ExperienceUploadModalProps {
  shelterId: string;
  shelterSlug: string;
  shelterTitle: string;
  onClose: () => void;
}

type Step = "upload" | "text" | "done";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_FILES = 4;

export function ExperienceUploadModal({
  shelterId,
  shelterSlug,
  shelterTitle,
  onClose,
}: ExperienceUploadModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const valid: File[] = [];
    const errors: string[] = [];
    Array.from(selected).slice(0, MAX_FILES).forEach((f) => {
      if (!ACCEPTED.includes(f.type)) {
        errors.push(`${f.name}: kun JPEG, PNG, WebP`);
        return;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${f.name}: maks ${MAX_SIZE_MB} MB`);
        return;
      }
      valid.push(f);
    });
    if (errors.length) { setError(errors.join(" · ")); return; }
    setError(null);
    setFiles(valid);
    setCoverIndex(0);
    const readers = valid.map((f) => new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target?.result as string);
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(setPreviews);
  };

  const handleSubmit = async () => {
    if (!authorName.trim()) { setError("Skriv dit fornavn"); return; }
    if (!body.trim()) { setError("Skriv en kort tekst om din oplevelse"); return; }
    if (body.length > 500) { setError("Tekst må maks være 500 tegn"); return; }
    setSubmitting(true);
    setError(null);

    try {
      // 1. Get presigned upload URLs
      const urlRes = await fetch("/api/experiences/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileCount: files.length }),
      });
      if (!urlRes.ok) throw new Error("Kunne ikke starte upload");
      const { experienceId: eid, uploads } = await urlRes.json();

      // 2. Upload each file via Supabase signed URL
      // Must use uploadToSignedUrl (not a raw PUT) — Supabase Storage requires the SDK method
      const { createBrowserSupabaseClient } = await import("@/utils/supabase/browser");
      const supabase = createBrowserSupabaseClient();
      await Promise.all(
        uploads.map(async (u: { index: number; signedUrl: string; token: string; path: string }, i: number) => {
          const { error: upErr } = await supabase.storage
            .from("experience-photos")
            .uploadToSignedUrl(u.path, u.token, files[i], { contentType: files[i].type });
          if (upErr) throw new Error(`Upload fejlede for billede ${i + 1}: ${upErr.message}`);
        })
      );

      // 3. Create experience record
      const photoPaths = uploads.map((u: { path: string }) => u.path);
      const createRes = await fetch("/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: eid,
          shelter_id: shelterId,
          author_name: authorName.trim(),
          body: body.trim(),
          photo_paths: photoPaths,
          cover_photo_index: coverIndex,
        }),
      });
      if (!createRes.ok) throw new Error("Kunne ikke gemme oplevelse");

      setExperienceId(eid);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noget gik galt, prøv igen");
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/shelter/${shelterSlug}`;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ESC key + body scroll lock + focus trap — modal is always "open" while mounted
  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstElement = () => {
      const target = firstActionRef.current ?? closeButtonRef.current;
      target?.focus();
    };
    const rafId = window.requestAnimationFrame(focusFirstElement);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modalRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="experience-upload-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/10">
          <div>
            <h2 id="experience-upload-modal-title" className="font-semibold text-primary text-base">Del din oplevelse</h2>
            <div className="text-xs text-primary/50">{shelterTitle}</div>
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Luk" className="p-2 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Step: upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
                aria-describedby="experience-upload-help"
              >
                <Upload className="w-8 h-8 text-primary/30" />
                <div className="text-sm font-medium text-primary/60">Klik for at vælge fotos</div>
                <div id="experience-upload-help" className="text-xs text-primary/50">JPEG, PNG, WebP · maks 10 MB · op til 4 billeder</div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {previews.length > 0 && (
                <div>
                  <div className="text-xs text-primary/50 mb-2">Klik for at vælge forsidebillede</div>
                  <div className="flex gap-2 flex-wrap">
                    {previews.map((src, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setCoverIndex(i)}
                        className={`relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 ${i === coverIndex ? "border-accent shadow-md" : "border-transparent"}`}
                        aria-label={i === coverIndex ? `Billede ${i + 1} valgt som forsidebillede` : `Vælg billede ${i + 1} som forsidebillede`}
                        aria-pressed={i === coverIndex}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {i === coverIndex && (
                          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-accent" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <div role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

              <button
                onClick={() => files.length > 0 ? setStep("text") : fileRef.current?.click()}
                disabled={files.length === 0}
                className="w-full bg-accent text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              >
                Næste <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step: text */}
          {step === "text" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-primary/60 uppercase tracking-wide block mb-1.5">Dit fornavn</label>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={60}
                  placeholder="Fx Allan"
                  className="w-full border border-primary/15 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary/60 uppercase tracking-wide block mb-1.5">Din oplevelse</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Fortæl kort om din tur..."
                  className="w-full border border-primary/15 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40 resize-none"
                />
                <div className="text-xs text-primary/40 text-right mt-1">{body.length}/500</div>
              </div>

              {error && <div role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-accent text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              >
                {submitting ? "Sender…" : "Indsend oplevelse"}
              </button>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && experienceId && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-primary mb-1">Tak for din oplevelse!</div>
                <div className="text-sm text-primary/60">Din oplevelse vises snart, når den er godkendt. Del den allerede nu i Facebook-gruppen.</div>
              </div>

              {/* OG card preview */}
              <div className="rounded-xl overflow-hidden border border-primary/10">
                <img
                  src={`/api/og/oplevelse/${experienceId}`}
                  alt="Dit share-kort"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 border border-primary/15 rounded-xl py-3 text-sm font-medium text-primary hover:bg-primary/5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
                >
                  {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                  {copied ? "Kopieret!" : "Kopiér link"}
                </button>
                <a
                  href={fbShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#1877f2] text-white rounded-xl py-3 text-sm font-semibold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877f2]/50 focus-visible:ring-offset-2"
                >
                  Del i Facebook-gruppen
                </a>
                <div className="text-xs text-primary/40">Åbner Facebook — vælg gruppen &ldquo;Shelters i Danmark&rdquo; og indsæt linket</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
