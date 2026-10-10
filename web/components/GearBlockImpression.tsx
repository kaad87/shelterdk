"use client";

import { useEffect, useRef } from "react";
import { trackGearBlockSeen } from "@/lib/tracking";

/**
 * Melder at grej-blokken faktisk er blevet set. Renderer intet.
 *
 * Uden en visning er blokkens ét klik på otte dage ikke til at tolke: det kan
 * både betyde at folk afviser den, og at de aldrig kommer ned til den. Med
 * visningen bliver klik-pr-visning målbar, og en flytning kan vurderes på den
 * rate frem for på et råt kliktal, der følger trafikken.
 *
 * IntersectionObserver frem for en scroll-lytter, fordi den ikke kører kode
 * ved hver scroll-event. Findes den ikke, meldes visningen med det samme —
 * et lidt for højt tal er bedre end et hul i nævneren.
 *
 * Bruger bevidst ikke lib/useInView: den no-op'er tavst når
 * IntersectionObserver mangler, hvilket er rigtigt for en indtonings-animation
 * og forkert for en måling. En nævner der lydløst mister rækker er netop den
 * fejl, der fik GA4-tallene til at vise 0,65 sidevisninger pr. Google-klik.
 * Hooken returnerer desuden state og udløser en ekstra render, som en ren
 * sidevirkning ikke har brug for.
 */
export function GearBlockImpression({
  shelterSlug,
  guideCount,
}: {
  shelterSlug: string;
  guideCount: number;
}) {
  const anker = useRef<HTMLSpanElement>(null);
  const sendt = useRef(false);

  useEffect(() => {
    if (sendt.current) return;

    const meld = () => {
      if (sendt.current) return;
      sendt.current = true;
      trackGearBlockSeen({ shelterSlug, guideCount });
    };

    const el = anker.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      meld();
      return;
    }

    const obs = new IntersectionObserver(
      (poster) => {
        if (poster.some((p) => p.isIntersecting)) {
          meld();
          obs.disconnect();
        }
      },
      // Halvdelen af blokken skal være inde, så en strejf i kanten under en
      // hurtig scroll ikke tælles som en visning.
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shelterSlug, guideCount]);

  return <span ref={anker} aria-hidden className="block h-0 w-0" />;
}
