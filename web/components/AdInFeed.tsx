"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ensureAdsenseScript, pushAd } from "@/lib/adsense";

const IN_FEED_SLOT = "6334579254";
const IN_FEED_LAYOUT_KEY = "-6x+d2-2i-2d+ng";

/**
 * In-feed-annonce til shelter-lister (PLP). Optager ÉN kort-plads i grid'et og
 * er stylet som et shelter-kort (samme radius/kant), så den følger listens
 * rytme i stedet for at bryde den som en fuld-bredde-stribe.
 *
 * Den beholder bevidst "Annonce"-mærket og en let afvigende baggrund: den skal
 * falde naturligt ind, men aldrig kunne forveksles med et shelter — både af
 * hensyn til brugeren og AdSense' regler om vildledende placering.
 *
 * Bruger AdSense' "fluid"-format + layout-key (i modsætning til AdBanner's
 * "auto"), fordi in-feed-blokke selv tilpasser sig listens udtryk.
 * Reserverer højde for at undgå layout-hop (CLS) mens annoncen loader.
 */
export function AdInFeed({ className }: { className?: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    ensureAdsenseScript();
    pushed.current = pushAd();
  }, []);

  return (
    <aside
      className={`flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02] ${className ?? ""}`}
      aria-label="Annonce"
    >
      <p className="px-3 pt-2.5 text-[11px] uppercase tracking-wide text-primary/40">
        Annonce
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 300 }}
        data-ad-format="fluid"
        data-ad-layout-key={IN_FEED_LAYOUT_KEY}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={IN_FEED_SLOT}
      />
    </aside>
  );
}
