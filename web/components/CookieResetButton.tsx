"use client";

import { resetCookieConsent } from "@/components/CookieBanner";

export function CookieResetButton() {
  return (
    <button
      type="button"
      onClick={resetCookieConsent}
      className="inline-block py-2 -my-2 text-white/75 hover:text-accent hover:underline text-sm transition-colors touch-manipulation"
    >
      Cookieindstillinger
    </button>
  );
}
