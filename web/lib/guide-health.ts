/**
 * Sundhedstjek pr. købsguide — bruges i admin.
 *
 * Findes fordi 37 af 194 produktpladser nåede at dø, uden at nogen kunne se
 * det uden at åbne hver guide for sig. Frontenden skjuler nu konsekvenserne
 * (udsolgte mister prædikat og demoteres), men det er stadig tabte pladser,
 * og det skal være synligt ét sted.
 */

export interface HealthEntry {
  inStock: boolean;
  isBlocked: boolean;
  /** Sidst set i forhandlerens feed. Gammel dato = varen er afmeldt, ikke bare udsolgt. */
  lastSeenAt: string | null;
  awardLabel: string | null;
}

export interface HealthInput {
  slug: string;
  lastReviewedAt: string | null;
  entries: HealthEntry[];
}

export interface GuideHealth {
  slug: string;
  total: number;
  /** Produkter der ikke kan købes lige nu. */
  dead: number;
  /** Produkter der har været ude af feedet i over 30 dage — kommer næppe igen. */
  delisted: number;
  problems: string[];
}

const MIN_BUYABLE = 4;
const DELISTED_DAYS = 30;
const REVIEW_DAYS = 120;

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (now.getTime() - t) / 86_400_000;
}

export function guideHealth(input: HealthInput, now: Date = new Date()): GuideHealth {
  const dead = input.entries.filter((e) => !e.inStock || e.isBlocked);
  const buyable = input.entries.length - dead.length;
  const delisted = dead.filter((e) => (daysSince(e.lastSeenAt, now) ?? 0) > DELISTED_DAYS);
  const awarded = dead.filter((e) => e.awardLabel);

  const problems: string[] = [];
  if (buyable < MIN_BUYABLE) problems.push(`kun ${buyable} produkter kan købes`);
  if (delisted.length) problems.push(`${delisted.length} produkt(er) afmeldt fra feedet i over ${DELISTED_DAYS} dage`);
  if (awarded.length) problems.push(`${awarded.length} udsolgt(e) produkt(er) har stadig et prædikat i basen`);
  const reviewAge = daysSince(input.lastReviewedAt, now);
  if (reviewAge == null) problems.push("aldrig gennemgået");
  else if (reviewAge > REVIEW_DAYS) problems.push(`gennemgået for ${Math.round(reviewAge)} dage siden`);

  return { slug: input.slug, total: input.entries.length, dead: dead.length, delisted: delisted.length, problems };
}
