/**
 * Formaterer et tidspunkt som relativ tid på dansk (fx "for 3 uger siden").
 */
export function formatRelativeTimeDa(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSec < 60) return "lige nu";
  if (diffMin < 60) return diffMin === 1 ? "for 1 minut siden" : `for ${diffMin} minutter siden`;
  if (diffHours < 24) return diffHours === 1 ? "for 1 time siden" : `for ${diffHours} timer siden`;
  if (diffDays < 7) return diffDays === 1 ? "for 1 dag siden" : `for ${diffDays} dage siden`;
  if (diffWeeks < 4) return diffWeeks === 1 ? "for 1 uge siden" : `for ${diffWeeks} uger siden`;
  if (diffMonths < 12) return diffMonths === 1 ? "for 1 måned siden" : `for ${diffMonths} måneder siden`;
  return diffYears === 1 ? "for 1 år siden" : `for ${diffYears} år siden`;
}
