/**
 * Kontrastkravet til affiliate-CTA'en, låst med en test.
 *
 * Knappen stod oprindeligt med hvid tekst på accent-guld #C5A059 = 2,46:1,
 * under WCAG AA's 4,5:1. Den blev rettet til primary-mørk (10,98:1), men
 * tallene efter udrulningen pegede på, at knappen holdt op med at ligne en
 * knap: konverteringen på de to ændrede flader faldt fra 39,2% til 26,3% af
 * trafikken, mens den urørte product-flade steg fra 6,9% til 12,3%. Ikke
 * statistisk sikkert (p≈0,09), men nok til ikke at lade det ligge.
 *
 * accent-dark #8A6A26 fandtes allerede i temaet og giver 5,04:1 med hvid
 * tekst: guld nok til at bære accentens "her handler du", og over kravet.
 */
export const CTA_BG = "#8A6A26"; // accent-dark
export const CTA_FG = "#FFFFFF";

function relativLuminans(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativLuminans(a);
  const l2 = relativLuminans(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
