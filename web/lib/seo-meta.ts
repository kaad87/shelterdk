/**
 * Centrale SEO-metadata-regler: hvornår DB-værdier er gode nok til SERP,
 * og fælles og:image-fallback (Next.js deep-merger ikke openGraph, så hver
 * side der sætter openGraph selv SKAL angive images eksplicit).
 */

/** Googles snippet-vindue er ~155-160 tegn; under 70 er spildt SERP-plads. */
const DESC_MIN = 70;
const DESC_MAX = 170;

/** Titler over ~65 tegn trunkeres i SERP. */
const TITLE_MAX = 65;

export const DEFAULT_OG_IMAGE = {
  url: "/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "Shelter i dansk natur",
} as const;

/**
 * Brug DB-beskrivelsen kun når den er i SERP-venligt interval (70–170 tegn);
 * ellers den genererede fallback. Mange shelters har rå beskrivelses-dumps
 * (2000+ tegn) eller stumper ("Shelter- og teltområde") i seo_description.
 */
export function chooseMetaDescription(
  dbValue: string | null | undefined,
  fallback: string
): string {
  const v = (dbValue ?? "").trim();
  if (v.length >= DESC_MIN && v.length <= DESC_MAX) return v;
  return fallback;
}

/**
 * Normalisér DB-titlens brand-suffix til "| ShelterDK" og fald tilbage til
 * den genererede titel når DB-titlen mangler eller er for lang til SERP.
 */
export function normalizeSeoTitle(
  dbValue: string | null | undefined,
  fallback: string
): string {
  const v = (dbValue ?? "").trim();
  if (!v) return fallback;
  const normalized = v.replace(/\s*\|\s*Shelterdk\.dk\s*$/i, " | ShelterDK");
  if (normalized.length > TITLE_MAX) return fallback;
  return normalized;
}

/** Klip ved ordgrænse med ellipsis i stedet for midt i et ord. */
export function truncateAtWord(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[,.\s–-]+$/, "") + "…";
}
