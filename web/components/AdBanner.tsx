"use client";

import { ADSENSE_CLIENT as CLIENT } from "@/lib/adsense";
import { useAdSlot } from "@/lib/useAdSlot";

/**
 * Diskret horisontal AdSense-banner ("Annonce"). Vises altid; Google håndterer
 * samtykke/personalisering via Consent Mode + Funding Choices (uden samtykke
 * serveres ikke-personaliserede annoncer). Reserverer højde for at undgå CLS.
 * Placeres i bunden af redaktionelt indhold — ikke på affiliate-/admin-sider.
 *
 * <ins> renderes først når beholderen er målt bred nok (useAdSlot). Uden det
 * blev push'et udført mens bredden stadig var 0 og Google svarede "No slot size
 * for availableWidth=0" — 184 uhåndterede fejl på 30 dage, flest på forsiden.
 */
export function AdBanner({ slot = "1359693016", className }: { slot?: string; className?: string }) {
  const { boxRef, ready } = useAdSlot();

  return (
    <aside ref={boxRef} className={`my-10 ${className ?? ""}`} aria-label="Annonce">
      <p className="mb-1 text-center text-[11px] uppercase tracking-wide text-primary/40">Annonce</p>
      {ready && (
        <ins
          className="adsbygoogle"
          style={{ display: "block", minHeight: 90 }}
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </aside>
  );
}
