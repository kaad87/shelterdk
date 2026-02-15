"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const CONSENT_KEY = "shelterdk_consent";

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
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (getConsent() !== "necessary") return;
    const key = pathname ?? "/";
    if (sent.current === key) return;
    sent.current = key;

    fetch("/api/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname || "/",
        title: document.title || undefined,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
