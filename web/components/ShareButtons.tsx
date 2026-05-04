"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Share2, Link2, Check, Facebook } from "lucide-react";
import { trackShare } from "@/lib/tracking";

interface ShareButtonsProps {
  title: string;
  url: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fullUrl = url.startsWith("http") ? url : `https://shelterdk.dk${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = useCallback(async () => {
    if (hasNativeShare) {
      try {
        await navigator.share({ title, url: fullUrl });
        trackShare("native", "shelter");
      } catch {
        // User cancelled or error - fall back to popover
        setOpen((o) => !o);
      }
      return;
    }
    setOpen((o) => !o);
  }, [hasNativeShare, title, fullUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      trackShare("copy_link", "shelter");
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      // Fallback: do nothing
    }
  }, [fullUrl]);

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-white px-3.5 py-2 text-xs font-medium text-primary/70 hover:text-primary hover:border-primary/20 hover:shadow-sm transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
        aria-label="Del dette shelter"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="share-buttons-panel"
      >
        <Share2 size={13} />
        Del
      </button>

      {open && (
        <div
          id="share-buttons-panel"
          ref={panelRef}
          className="absolute top-full right-0 mt-2 z-50 animate-pop-in"
        >
          <div className="rounded-xl border border-primary/10 bg-white shadow-lg p-1.5 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                copied
                  ? "bg-emerald-50 text-emerald-600"
                  : "text-primary/60 hover:bg-primary/5 hover:text-primary"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              {copied ? "Kopieret!" : "Kopiér link"}
            </button>

            <div className="w-px h-5 bg-primary/10" />

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackShare("facebook", "shelter")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary/60 hover:bg-[#1877F2]/10 hover:text-[#1877F2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2]/40"
              title="Facebook"
              aria-label="Del på Facebook"
            >
              <Facebook size={14} />
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackShare("twitter", "shelter")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary/60 hover:bg-primary/5 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              title="X / Twitter"
              aria-label="Del på X"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
