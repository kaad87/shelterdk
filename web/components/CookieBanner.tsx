"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "shelterdk_consent";
const CONSENT_COOKIE = "shelterdk_consent";
const COOKIE_MAX_AGE_DAYS = 365;

export type ConsentChoice = "accept" | "necessary";

function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accept" || v === "necessary") return v;
  } catch {
    // ignore
  }
  return null;
}

function setConsentStorage(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax; Secure`;
  } catch {
    // ignore
  }
}

const GTM_ID = "GTM-MT8S798N";

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentChoice | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setConsent(getStoredConsent());
    setMounted(true);
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    setConsentStorage(choice);
    setConsent(choice);
  };

  const showBanner = mounted && consent === null;

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-label="Cookievalg"
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-4xl px-4 pb-4 pt-2 sm:px-6 sm:pb-6"
        >
          <div className="rounded-xl border border-primary/20 bg-white shadow-lg ring-1 ring-black/5">
            <div className="p-4 sm:p-5">
              <p className="text-sm text-primary leading-relaxed">
                Vi bruger nødvendige cookies så siden fungerer, og valgfrie cookies til statistik
                og forbedring. Du kan vælge kun nødvendige eller acceptere alle.{" "}
                <Link
                  href="/privacy"
                  className="text-accent underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
                >
                  Læs mere om cookies
                </Link>
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleChoice("accept")}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
                >
                  Acceptér alle
                </button>
                <button
                  type="button"
                  onClick={() => handleChoice("necessary")}
                  className="rounded-lg border border-primary/30 bg-background px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
                >
                  Kun nødvendige
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {consent === "accept" && (
        <>
          <Script
            id="gtm"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}
    </>
  );
}
