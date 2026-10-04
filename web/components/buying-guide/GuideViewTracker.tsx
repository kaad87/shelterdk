"use client";

import { useEffect, useRef } from "react";
import { trackGuideView } from "@/lib/tracking";

/**
 * Tæller et besøg på en købsguide.
 *
 * GA4 kan ikke bruges som nævner her. Målt over 28 dage fik /bedste-siderne
 * 0,65 GA4-visninger pr. Google-klik — færre visninger end klik, hvilket er
 * fysisk umuligt. Alle andre sidetyper lå mellem 1,5 og 4,8. Forskellen er
 * samtykkeløse pings plus annonceblokering af googletagmanager.com, som rammer
 * hårdest netop hos dem der søger på grej. Samme-oprindelses-kaldet til
 * /api/track slipper igennem: affiliate-klik står 191 i Supabase mod 7 i GA4.
 *
 * `fra` læses af window.location inde i effekten, IKKE med useSearchParams.
 * Hooket tvinger siden ud af statisk rendering og kræver en Suspense-grænse;
 * uden den fejler buildet med "useSearchParams() should be wrapped in a
 * suspense boundary" på alle 30 guider. Effekten kører kun i browseren, så
 * søgestrengen er tilgængelig direkte — og de 30 guider forbliver statiske.
 *
 * Affyres én gang pr. montering. Guidesiden er ISR-cachet, så visningen kan
 * ikke tælles på serveren.
 */
export function GuideViewTracker({ slug }: { slug: string }) {
  const sendt = useRef(false);

  useEffect(() => {
    if (sendt.current) return;
    sendt.current = true;
    // ?fra=shelter sættes af grej-blokken; bevares så tragten kan skilles ad.
    let fra: string | undefined;
    try {
      fra = new URLSearchParams(window.location.search).get("fra") ?? undefined;
    } catch {
      fra = undefined;
    }
    trackGuideView({ guideSlug: slug, fra });
  }, [slug]);

  return null;
}
