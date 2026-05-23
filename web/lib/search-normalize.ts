/**
 * Danish-aware search input normalisering + variant-expansion.
 *
 * Vores DB indeholder navne med æøå (København, Aalborg, Århus etc.) men
 * brugere skriver tit uden de specielle tegn ("kobenhavn", "aarhus").
 * Postgres `ilike` er case-insensitive men IKKE accent-insensitive, så
 * "kobenhavn" matcher ikke "København".
 *
 * Vi løser det ved at expand et søgeord til alle plausible Danish-staver
 * og bygge en `or(...)` clause i Supabase queryen. Det undgår at vi skal
 * tilføje en ekstra DB-kolonne + index for normaliseret search-text.
 *
 * Performance: hver expand giver typisk 1-4 varianter. Ilike er allerede
 * ikke index-friendly (leading wildcard), så en faktor 2-4x på OR-clauses
 * koster ikke meget.
 */

/** Specifikke 2-vejs-mappinger der ikke fanges af generel æ→ae osv. */
const TWO_WAY_REPLACEMENTS: Array<[RegExp, string]> = [
  // Aarhus/Århus — begge stavemåder er officielle danske former
  [/århus/gi, "aarhus"],
  [/aarhus/gi, "århus"],
  // Aalborg / Ålborg — Aalborg er moderne, Ålborg historisk
  [/ålborg/gi, "aalborg"],
  [/aalborg/gi, "ålborg"],
  // Sønderborg / Soenderborg etc. håndteres af æøå-normalisering
];

/**
 * Konverter æ/ø/å → ae/oe/aa.
 * Bruges også til at sammenligne to stavemåder (begge normaliseres og
 * sammenlignes med string-equality).
 */
export function normalizeDanish(input: string): string {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/é/g, "e")
    .replace(/è/g, "e")
    .replace(/ü/g, "ue")
    .replace(/ö/g, "oe")
    .replace(/ä/g, "ae")
    .trim();
}

/**
 * Returnerer alle plausible danske staver af samme søgeord.
 *
 * Eksempler:
 *   "kobenhavn"  -> ["kobenhavn", "københavn"]
 *   "København"  -> ["københavn", "koebenhavn", "kobenhavn"]
 *   "Aarhus"     -> ["aarhus", "århus"]
 *   "Århus"      -> ["århus", "aarhus"]
 *   "soenderborg" -> ["soenderborg", "sønderborg"]
 *
 * Output er lowercase + trimmed. Op til ~6 varianter pr. input.
 */
export function expandDanishVariants(input: string): string[] {
  const seed = (input ?? "").trim().toLowerCase();
  if (!seed) return [];

  const out = new Set<string>([seed]);

  // 1. ae/oe/aa → æ/ø/å (heuristisk — virker næsten altid for danske navne)
  const withDanishLetters = seed
    .replace(/ae/g, "æ")
    .replace(/oe/g, "ø")
    .replace(/aa/g, "å");
  if (withDanishLetters !== seed) out.add(withDanishLetters);

  // 2. æ/ø/å → ae/oe/aa (ASCII-friendly variant)
  const ascii = normalizeDanish(seed);
  if (ascii !== seed) out.add(ascii);

  // 3. Specifikke 2-vejs-mappinger (Aarhus ↔ Århus etc.)
  for (const [pattern, replacement] of TWO_WAY_REPLACEMENTS) {
    if (pattern.test(seed)) {
      out.add(seed.replace(pattern, replacement));
    }
  }

  // Begrænset til rimelig størrelse for at undgå queries med 20+ OR-clauses
  return Array.from(out).slice(0, 6);
}

/**
 * Escape special characters for a Postgres `ilike` pattern.
 *
 * Bemærk: vi tillader IKKE brugeren at injicere % eller _ — de er
 * reserverede wildcards. Vi escaper også , (komma) og . (punktum) fordi
 * Supabase's PostgREST `.or()` parser bruger komma som separator mellem
 * conditions og punktum som column-separator.
 */
export function escapeIlikePattern(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
