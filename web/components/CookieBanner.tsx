"use client";

import Script from "next/script";

const GTM_ID = "GTM-MT8S798N";

/**
 * Genåbner Googles CMP-samtykkedialog (Funding Choices). Bruges af
 * "administrér cookies"-knappen, nu hvor Googles certificerede CMP har
 * overtaget samtykke-UI'et fra det gamle hjemmelavede banner.
 */
export function resetCookieConsent() {
  const w = window as unknown as {
    googlefc?: {
      showRevocationMessage?: () => void;
      callbackQueue?: { push: (cb: unknown) => void };
    };
  };
  if (typeof w.googlefc?.showRevocationMessage === "function") {
    w.googlefc.showRevocationMessage();
  } else if (w.googlefc?.callbackQueue) {
    // CMP'en er måske ikke loadet endnu — kø handlingen.
    w.googlefc.callbackQueue.push({
      CONSENT_DATA_READY: () => w.googlefc?.showRevocationMessage?.(),
    });
  }
}

/**
 * Indlæser måle- og annonce-scripts. Selve samtykket håndteres nu af
 * Googles certificerede CMP (AdSense → Privatliv og beskeder) med Consent
 * Mode v2 slået til — så GTM og AdSense automatisk respekterer brugerens
 * valg (cookieless/ikke-personaliseret indtil samtykke).
 *
 * Komponenten har bevidst INGEN synlig banner-UI længere: Googles CMP er
 * det eneste samtykke-banner. Det gamle hjemmelavede banner + StackAdapt er
 * fjernet for at undgå to bannere og dobbelt samtykke-signal.
 */
export function CookieBanner() {
  return (
    <>
      {/* GTM — loader altid, respekterer Consent Mode v2 (cookieless når denied) */}
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

      {/* AdSense — loader for alle; Googles CMP + Consent Mode v2 styrer
          personaliseringen (personaliseret ved samtykke, ellers limited ads). */}
      {process.env.NEXT_PUBLIC_ADSENSE_PUB_ID && (
        <Script
          async
          id="adsense"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_PUB_ID}`}
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      )}
    </>
  );
}
