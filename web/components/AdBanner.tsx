"use client";

import { ADSENSE_CLIENT as CLIENT } from "@/lib/adsense";
import { useAdSlot } from "@/lib/useAdSlot";

/**
 * Diskret horisontal AdSense-banner ("Annonce"). Google håndterer
 * samtykke/personalisering via Consent Mode + Funding Choices (uden samtykke
 * serveres ikke-personaliserede annoncer). Reserverer højde for at undgå CLS.
 * Placeres i bunden af redaktionelt indhold — ikke på affiliate-/admin-sider.
 *
 * <ins> renderes først når beholderen er målt bred nok (useAdSlot). Uden det
 * blev push'et udført mens bredden stadig var 0 og Google svarede "No slot size
 * for availableWidth=0" — 184 uhåndterede fejl på 30 dage, flest på forsiden.
 *
 * Mærket "Annonce" er usynligt (opacity, ikke display) indtil AdSense melder
 * pladsen fyldt, og hele boksen fjernes hvis svaret er "unfilled". Uden det
 * stod mærket over tom, reserveret plads i ~1 sekund på hver indlæsning — og
 * for altid, hvis pladsen aldrig blev fyldt. Opacity frem for display, så
 * højden ikke ændrer sig undervejs og skubber indholdet under annoncen.
 */
export function AdBanner({ slot = "1359693016", className }: { slot?: string; className?: string }) {
  const { boxRef, ready, filled } = useAdSlot();

  return (
    <aside
      ref={boxRef}
      className={`my-10 ${filled === false ? "hidden" : ""} ${className ?? ""}`}
      aria-label="Annonce"
    >
      <p
        className={`mb-1 text-center text-[11px] uppercase tracking-wide text-primary/40 transition-opacity duration-300 ${
          filled ? "opacity-100" : "opacity-0"
        }`}
      >
        Annonce
      </p>
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
