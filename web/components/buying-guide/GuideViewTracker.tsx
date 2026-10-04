"use client";

import { useEffect, useRef } from "react";
import { useSafeSearchParams } from "@/lib/useSafeSearchParams";
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
 * Uden en troværdig nævner kommer konverteringsraterne ud som nonsens —
 * /bedste/vandresokker regnede til 250% på GA4-tal.
 *
 * Affyres én gang pr. montering. Guidesiden er ISR-cachet, så visningen kan
 * ikke tælles på serveren.
 */
export function GuideViewTracker({ slug }: { slug: string }) {
  // useSafeSearchParams, ikke useSearchParams: den sidste returnerer null under
  // statisk prerender uden Suspense-grænse, og typen lyver om det.
  const params = useSafeSearchParams();
  const sendt = useRef(false);

  useEffect(() => {
    if (sendt.current) return;
    sendt.current = true;
    // ?fra=shelter sættes af grej-blokken; bevares så tragten kan skilles ad.
    trackGuideView({ guideSlug: slug, fra: params.get("fra") ?? undefined });
  }, [slug, params]);

  return null;
}
