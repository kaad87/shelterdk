"use client";

import { resetCookieConsent } from "@/components/CookieBanner";

export function CookieResetButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={resetCookieConsent}
      className={`inline-block py-2 text-sm text-white/75 transition-colors hover:text-accent hover:underline touch-manipulation ${className}`.trim()}
    >
      Cookieindstillinger
    </button>
  );
}
