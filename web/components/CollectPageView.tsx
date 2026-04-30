"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CONSENT_KEY, CONSENT_UPDATED_EVENT } from "@/lib/consent";

function getConsent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

/**
 * Når brugeren har valgt "Kun nødvendige", sender vi én anonym page_view per side
 * til vores API som videresender til GA4 (server-side). Ingen cookies til tracking.
 */
export function CollectPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<string | null>(null);
  const sent = useRef<string | null>(null);
  const query = searchParams.toString();
  const path = pathname ?? "/";
  const pagePath = query ? `${path}?${query}` : path;

  useEffect(() => {
    const syncConsent = () => {
      setConsent(getConsent());
    };

    syncConsent();
    window.addEventListener(CONSENT_UPDATED_EVENT, syncConsent);
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  useEffect(() => {
    if (consent !== "necessary") return;
    const key = pagePath;
    if (sent.current === key) return;
    sent.current = key;

    fetch("/api/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `${window.location.pathname}${window.location.search}` || "/",
        title: document.title || undefined,
        referrer: document.referrer || "",
      }),
    }).catch(() => {});
  }, [consent, pagePath]);

  return null;
}
