"use client";

import { ADSENSE_CLIENT } from "@/lib/adsense";
import { useAdSlot } from "@/lib/useAdSlot";

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
 *
 * BREDDE: fluid-formatet kræver mindst 250 px. Det smalle split-layout på
 * facet-region-siderne (fx `/shelter-med-toilet/sjaelland`) giver kun ~233 px
 * pr. kolonne og udløste 238 TagErrors på 8 dage — listekolonnen er ~55 % af
 * max-w-5xl minus padding, delt i to af `sm:grid-cols-2`. Derfor måles
 * beholderen først (useAdSlot), og er den
 * for smal spænder annoncen over hele grid-rækken i stedet — så bliver den
 * bred nok og pladsen går ikke tabt. <ins> renderes først når bredden er god.
 */
export function AdInFeed({ className }: { className?: string }) {
  const { boxRef, ready, tooNarrow } = useAdSlot();

  return (
    <aside
      ref={boxRef}
      className={`flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02] ${
        tooNarrow ? "col-span-full" : ""
      } ${className ?? ""}`}
      aria-label="Annonce"
    >
      <p className="px-3 pt-2.5 text-[11px] uppercase tracking-wide text-primary/40">
        Annonce
      </p>
      {ready && (
        <ins
          className="adsbygoogle"
          style={{ display: "block", minHeight: 300 }}
          data-ad-format="fluid"
          data-ad-layout-key={IN_FEED_LAYOUT_KEY}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={IN_FEED_SLOT}
        />
      )}
    </aside>
  );
}
