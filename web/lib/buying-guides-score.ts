/** Konverter 0-10 score til 0-5 stjerner, afrundet til nærmeste halve. */
export function scoreToStars(score: number): number {
  const onFive = (score / 10) * 5;
  const rounded = Math.round(onFive * 2) / 2;
  return Math.max(0, Math.min(5, rounded));
}

/** Formatér score med én decimal og dansk komma. Null/undefined → "". */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return "";
  return score.toFixed(1).replace(".", ",");
}
