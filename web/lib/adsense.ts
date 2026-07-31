export const ADSENSE_CLIENT = "ca-pub-4295774462032317";

let scriptInjected = false;

/** Indlæser AdSense-scriptet én gang pr. session (delt af alle annonce-komponenter). */
export function ensureAdsenseScript() {
  if (typeof document === "undefined") return;
  if (scriptInjected || document.querySelector('script[src*="adsbygoogle.js"]')) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement("script");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
  scriptInjected = true;
}

/**
 * In-feed-annoncen indsættes FØR dette kort-index i shelter-lister — dvs. efter
 * to rækker på desktop (3 kolonner). Kun når listen er lang nok til at der også
 * er indhold UNDER annoncen; på korte lister ville den ellers lande i bunden og
 * ligne en footer-annonce.
 */
const IN_FEED_AFTER_INDEX = 6;
const IN_FEED_MIN_ITEMS = 8;

export function showInFeedAdAt(index: number, total: number): boolean {
  return index === IN_FEED_AFTER_INDEX && total >= IN_FEED_MIN_ITEMS;
}

/** Beder AdSense fylde den senest renderede <ins>. Fejler stille hvis scriptet ikke er klar. */
export function pushAd() {
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] };
    w.adsbygoogle = w.adsbygoogle || [];
    w.adsbygoogle.push({});
    return true;
  } catch {
    return false;
  }
}
