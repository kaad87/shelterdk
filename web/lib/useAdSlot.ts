"use client";

import { useEffect, useRef, useState } from "react";
import { ensureAdsenseScript, pushAd } from "@/lib/adsense";

/**
 * AdSense' minimumsbredde. Under den afviser Google pladsen med en TagError
 * ("No slot size for availableWidth=0" / "Fluid responsive ads must be at
 * least 250px wide").
 */
export const AD_MIN_WIDTH = 250;

/**
 * Hvor tæt på viewporten pladsen skal være, før annoncen hentes. Stort nok til
 * at annoncen er indlæst når den rammer skærmen, lille nok til at den ikke
 * hentes for nogen der aldrig scroller så langt.
 */
const AD_ROOT_MARGIN = "300px";

/**
 * Måler annoncebeholderen og melder først klar når den både har brugbar bredde
 * OG er ved at komme i syne.
 *
 * `adsbygoogle.push({})` binder sig til den FØRSTE ufyldte <ins> i DOM-orden og
 * læser dens bredde med det samme. Er bredden 0 (endnu ikke layoutet, skjult
 * breakpoint, baggrundsfane) eller under AD_MIN_WIDTH, kaster Google en
 * TagError og pladsen er brugt op. Det gav 422 uhåndterede fejl på 8 dage i
 * produktion — 238 × availableWidth=240 fra det smalle split-layout på
 * facet-region-siderne (fx `/shelter-med-toilet/sjaelland`), og 184 ×
 * availableWidth=0.
 *
 * Kaldestedet må derfor IKKE rendere <ins> før `ready` er sand. At udskyde selve
 * push'et er ikke nok: så ville et andet, bredere annonce-element pushe først og
 * få sit indhold bundet til den smalle <ins> der stadig stod først i DOM'en.
 * Ved at holde <ins> ude af DOM'en indtil bredden er god, kan fejlparringen ikke
 * opstå.
 *
 * `tooNarrow` er sand når beholderen ER layoutet men for smal. Kaldestedet kan
 * bruge det til at gøre sig bredere (fx spænde over hele grid-rækken) — målingen
 * gentages så af ResizeObserver og pladsen kommer med alligevel.
 *
 * VIEWPORT-GATING: annoncen hentes først når pladsen nærmer sig skærmen.
 * Uden det blev ALLE annoncer på en side hentet ved indlæsning, også dem langt
 * nede som ingen nåede. Målt over 7 dage gav det 25,3 % viewability på kontoen,
 * og in-feed-enheden alene 11,89 %. Værst var /soeg: 3 % af trafikken men 22 %
 * af alle visninger ved 3,78 % viewability, fordi <AdInFeed> remounter ved hvert
 * skift af visning, sortering, filter og ved uendelig scroll — og hver remount
 * var et nyt push.
 *
 * BEMÆRK hvad dette gør og ikke gør: det skaber ikke nye sete visninger, det
 * fjerner spildte. Antallet af visninger FALDER, indtjeningen er kortsigtet
 * omtrent uændret, men kontoens viewability stiger markant — og det er den
 * annoncørerne byder efter.
 */
export function useAdSlot(minWidth: number = AD_MIN_WIDTH) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tooNarrow, setTooNarrow] = useState(false);
  const readyRef = useRef(false);
  const widened = useRef(false);
  const pushed = useRef(false);
  const nearViewport = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const measure = () => {
      if (readyRef.current) return;
      const w = el.getBoundingClientRect().width;
      // Bredde 0 = endnu ikke layoutet (skjult fane, collapsed pane). Vent på
      // næste ResizeObserver-tik i stedet for at melde "for smal" — ellers ville
      // vi udvide på et falsk grundlag.
      if (w === 0) return;

      if (w < minWidth) {
        // `widened` LÅSER beslutningen. Uden den ville vi sætte tooNarrow=false
        // igen så snart udvidelsen havde virket, hvorefter boksen krympede
        // tilbage under grænsen og udvidede sig igen — en uendelig
        // render-løkke ved kolonnebredder lige omkring minWidth.
        if (!widened.current) {
          widened.current = true;
          setTooNarrow(true);
        }
        return;
      }

      // Bredden er god. Selve hentningen — og dermed <ins> i DOM'en — venter til
      // pladsen nærmer sig skærmen. Bemærk at målingen og en eventuel udvidelse
      // sker FØR denne gate: gjorde de ikke det, ville en for smal annonce først
      // udvide sig i det øjeblik brugeren scrollede ned til den, og skubbe
      // kortene under sig ned midt i scrollet.
      if (!nearViewport.current) return;

      readyRef.current = true;
      setReady(true);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // IntersectionObserver frigiver gaten; ResizeObserver holder målingen ved
    // lige. Begge skal være tilfredse, og rækkefølgen er ligegyldig — den sidste
    // af dem der fyrer, udløser målingen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        nearViewport.current = true;
        io.disconnect();
        measure();
      },
      { rootMargin: AD_ROOT_MARGIN }
    );
    io.observe(el);

    measure();
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [minWidth]);

  // Kører først når <ins> faktisk er i DOM'en, så push'et parres korrekt.
  useEffect(() => {
    if (!ready || pushed.current) return;
    ensureAdsenseScript();
    pushed.current = pushAd();
  }, [ready]);

  return { boxRef, ready, tooNarrow };
}
