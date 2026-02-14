/**
 * URL-safe slugs for silo routes: /danmark/[region]/[municipality]/[shelter_slug]
 * Consistent slugify so we can map params back to display names.
 */

/** Convert region or municipality name to URL segment (lowercase, spaces to hyphens, Danish to ASCII). */
export function slugifySegment(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9-]/g, "") // drop any other non-ASCII
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "";
}

/**
 * Find display name from a slug by matching against a list of known names.
 * Used to resolve [region] or [municipality] param back to the value stored in DB.
 */
export function segmentSlugToName(
  slug: string,
  candidates: string[],
  slugify: (s: string) => string = slugifySegment
): string | null {
  const s = (slug || "").trim().toLowerCase();
  if (!s) return null;
  for (const c of candidates) {
    if (slugify(c) === s) return c;
  }
  return null;
}
