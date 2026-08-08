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
/**
 * Første annonce efter 4 kort, ikke 6. På mobil er grid'et én kolonne, så plads
 * 6 lå ~1.800 px nede og blev sjældent nået: in-feed-enheden målte 11,89 %
 * viewability mod bannerets 36,99 % over 7 dage. Dens viewable CPM er samtidig
 * HØJERE end bannerets (13,38 mod 9,54 DKK) — inventaret er altså godt, det var
 * placeringen der var gal, så den flyttes op frem for at blive skåret væk.
 *
 * ANNONCENS PLADS I GRID'ET SKAL VÆRE LIGE. Er kortkolonnen smallere end
 * 250 px, spænder <AdInFeed> over hele grid-rækken (se useAdSlot). Et element
 * der fylder to kolonner kan ikke starte midt i en række, så på en ulige plads
 * skubbes det ned til næste række og efterlader et synligt hul hvor der mangler
 * et kort. Alle de layouts hvor kolonnen faktisk bliver så smal — /by, /soeg's
 * split-visning og facet-region-siderne — er 2-kolonners grids ved siden af et
 * kort.
 *
 * FÆLDEN: annoncen optager SELV en plads, så den n'te annonce står på
 * grid-plads `shelterIndex + n`, ikke på `shelterIndex`. Derfor skal intervallet
 * være ULIGE, så pariteten holder for alle tre annoncer:
 *   start 4, interval 5  →  shelter 4, 9, 14  →  grid-plads 4, 10, 16 (lige) ✓
 *   start 4, interval 6  →  shelter 4, 10, 16 →  grid-plads 4, 11, 18 (11 ulige) ✗
 * Prøvede først start 3 (hul med det samme på /by/billund), derefter start 4
 * med interval 6 — som kun flyttede hullet ned til annonce nummer to.
 */
const IN_FEED_FIRST_INDEX = 4;
const IN_FEED_INTERVAL = 5;
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
