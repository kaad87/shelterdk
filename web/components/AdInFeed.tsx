"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ensureAdsenseScript, pushAd } from "@/lib/adsense";

const IN_FEED_SLOT = "6334579254";
const IN_FEED_LAYOUT_KEY = "-6x+d2-2i-2d+ng";

/**
 * In-feed-annonce til shelter-lister (PLP). Ligger som et element i grid'et og
 * spænder hele bredden, så den følger læseretningen mellem kort-rækkerne.
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
      className={`col-span-full my-2 ${className ?? ""}`}
      aria-label="Annonce"
    >
      <p className="mb-1 text-center text-[11px] uppercase tracking-wide text-primary/40">
        Annonce
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 120 }}
        data-ad-format="fluid"
        data-ad-layout-key={IN_FEED_LAYOUT_KEY}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={IN_FEED_SLOT}
      />
    </aside>
  );
}
