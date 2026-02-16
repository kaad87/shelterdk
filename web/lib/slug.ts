/**
 * URL-safe slugs for silo routes: /danmark/[region]/[municipality]/[shelter_slug]
 * Bruger ae, oe, aa (URL-venlige) så Google og brugere får pæne URLs uden æ, ø, å.
 */

/** URL-venlig slug: små bogstaver, mellemrum → bindestreg, æ→ae, ø→oe, å→aa. */
function slugifyInternal(
  name: string | null | undefined,
  opts: { ø: "oe" | "o"; å: "aa" | "a" }
): string {
  if (!name || typeof name !== "string") return "";
  let s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/æ/g, "ae")
    .replace(/ø/g, opts.ø)
    .replace(/å/g, opts.å)
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

/** Convert region or municipality name to URL segment (lowercase, hyphens, æ→ae, ø→oe, å→aa). */
export function slugifySegment(name: string | null | undefined): string {
  return slugifyInternal(name, { ø: "oe", å: "aa" });
}

/** Ældre variant (ø→o, å→a) – bruges til at acceptere gamle URL-segmenter. */
export function slugifySegmentLegacy(name: string | null | undefined): string {
  return slugifyInternal(name, { ø: "o", å: "a" });
}

/**
 * Find display name from a slug by matching against a list of known names.
 * Tester først URL-venlig slug (oe, aa); derefter ældre form (o, a) så gamle links virker.
 */
export function segmentSlugToName(
  slug: string,
  candidates: string[],
  slugifyFn: (s: string) => string = slugifySegment
): string | null {
  const s = (slug || "").trim().toLowerCase();
  if (!s) return null;
  for (const c of candidates) {
    if (slugifyFn(c) === s) return c;
  }
  if (slugifyFn === slugifySegment) {
    return segmentSlugToName(slug, candidates, slugifySegmentLegacy);
  }
  return null;
}
