/**
 * Bygger den korte, citérbare sætning til "Hurtigt svar"-answer-capslen
 * (.llm-quote). Sætningen er bevidst link-fri, faktuel og fyldt med
 * konkrete tal — det er præcis den slags LLM'er (ChatGPT, Perplexity,
 * Google AI Overviews) trækker direkte ind i svar. Hver side får unikke
 * tal + stednavn, så indholdet ikke er boilerplate på tværs af sider.
 */

export interface QuickAnswerStats {
  count: number;
  bookable?: number;
  toilet?: number;
  water?: number;
}

/** Sammenføj klausuler med dansk "og" før sidste led. */
function joinDanish(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} og ${parts[parts.length - 1]}`;
}

/**
 * @param locationPhrase Stedsætning MED stort begyndelsesbogstav og evt.
 *   præposition, fx "I Aarhus Kommune", "På Bornholm", "I Jylland".
 * @param stats Konkrete tal. Udeladte/0-felter springes over i sætningen.
 * @param noun Ental af substantivet (default "shelter").
 * @param nounPlural Flertal (default "shelters").
 */
export function buildQuickAnswer(
  locationPhrase: string,
  stats: QuickAnswerStats,
  noun = "shelter",
  nounPlural = "shelters"
): string {
  const word = stats.count === 1 ? noun : nounPlural;

  if (stats.count <= 0) {
    return `${locationPhrase} har vi endnu ikke registreret nogen ${nounPlural}.`;
  }

  const clauses: string[] = [];
  if (stats.bookable && stats.bookable > 0) clauses.push(`${stats.bookable} kan bookes`);
  if (stats.toilet && stats.toilet > 0) clauses.push(`${stats.toilet} har toilet`);
  if (stats.water && stats.water > 0) clauses.push(`${stats.water} har adgang til vand`);

  const tail = clauses.length > 0 ? `, hvoraf ${joinDanish(clauses)}` : "";
  return `${locationPhrase} finder du ${stats.count} ${word}${tail}.`;
}
