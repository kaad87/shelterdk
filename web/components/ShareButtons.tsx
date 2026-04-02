"use client";

import { useEffect, useState } from "react";
import { Share2, Link2, Facebook, Check } from "lucide-react";
import { trackShare } from "@/lib/tracking";

interface ShareButtonsProps {
  title: string;
  url: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fullUrl = url.startsWith("http") ? url : `https://shelterdk.dk${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl });
        trackShare("native", "shelter");
      } catch {
        // User cancelled
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      trackShare("copy_link", "shelter");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-primary/60 mr-1">Del:</span>
      {mounted && typeof navigator !== "undefined" && "share" in navigator && (
        <button
          onClick={handleNativeShare}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/5 text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors touch-manipulation"
          title="Del"
          aria-label="Del"
        >
          <Share2 size={15} />
        </button>
      )}
      <button
        onClick={handleCopy}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/5 text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors touch-manipulation"
        title={copied ? "Kopieret!" : "Kopiér link"}
        aria-label="Kopiér link"
      >
        {copied ? <Check size={15} className="text-green-600" /> : <Link2 size={15} />}
      </button>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("facebook", "shelter")}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/5 text-primary/60 hover:bg-[#1877F2]/10 hover:text-[#1877F2] transition-colors touch-manipulation"
        title="Del på Facebook"
        aria-label="Del på Facebook"
      >
        <Facebook size={15} />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("twitter", "shelter")}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/5 text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors touch-manipulation"
        title="Del på X/Twitter"
        aria-label="Del på X/Twitter"
      >
        <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-current" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </div>
  );
}
