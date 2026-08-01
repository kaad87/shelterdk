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
 * In-feed-annoncer i shelter-lister. Annoncen optager én kort-plads i grid'et
 * (i stedet for en fuld-bredde-stribe), så den følger listens rytme — det er
 * netop hvad AdSense' in-feed-format er lavet til.
 *
 * Første efter 6 kort, derefter for hver 6. Ingen shelters fjernes; annoncen
 * skydes ind mellem dem, så alle kort (og deres interne links) bevares.
 * Loftet holder sidetætheden nede — for mange annoncer skader både oplevelsen
 * og RPM'en.
 */
const IN_FEED_FIRST_INDEX = 6;
const IN_FEED_INTERVAL = 6;
const IN_FEED_MAX_PER_PAGE = 3;
const IN_FEED_MIN_ITEMS = 8;
/** Mindst så mange kort skal ligge UNDER annoncen — ellers virker den som footer. */
const IN_FEED_MIN_TRAILING = 2;

export function showInFeedAdAt(index: number, total: number): boolean {
  if (total < IN_FEED_MIN_ITEMS) return false;
  if (index < IN_FEED_FIRST_INDEX) return false;
  if ((index - IN_FEED_FIRST_INDEX) % IN_FEED_INTERVAL !== 0) return false;
  if (total - index < IN_FEED_MIN_TRAILING) return false;
  const adNumber = (index - IN_FEED_FIRST_INDEX) / IN_FEED_INTERVAL;
  return adNumber < IN_FEED_MAX_PER_PAGE;
}

/** Løbenummer for annoncen på et givet index — bruges til stabile React-keys. */
export function inFeedAdIndex(index: number): number {
  return (index - IN_FEED_FIRST_INDEX) / IN_FEED_INTERVAL;
}

/**
 * Mindste antal indholdsblokke før en artikel også får en annonce inde i teksten
 * (ud over den i bunden). Korte artikler bærer kun én.
 */
export const IN_ARTICLE_MIN_BLOCKS = 8;

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
