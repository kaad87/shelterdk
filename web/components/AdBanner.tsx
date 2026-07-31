"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT as CLIENT, ensureAdsenseScript, pushAd } from "@/lib/adsense";

/**
 * Diskret horisontal AdSense-banner ("Annonce"). Vises altid; Google håndterer
 * samtykke/personalisering via Consent Mode + Funding Choices (uden samtykke
 * serveres ikke-personaliserede annoncer). Reserverer højde for at undgå CLS.
 * Placeres i bunden af redaktionelt indhold — ikke på affiliate-/admin-sider.
 */
export function AdBanner({ slot = "1359693016", className }: { slot?: string; className?: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    ensureAdsenseScript();
    pushed.current = pushAd();
  }, []);

  return (
    <aside className={`my-10 ${className ?? ""}`} aria-label="Annonce">
      <p className="mb-1 text-center text-[11px] uppercase tracking-wide text-primary/40">Annonce</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 90 }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
