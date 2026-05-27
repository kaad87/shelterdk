import type { Shelter } from "@/types/shelter";
import { isStructuredBookable } from "@shared/lib/shelter-detail";

/**
 * Outreach-kandidat: en shelter-ejer der potentielt vil have gavn af
 * ShelterDK's bookingsystem. Skor højere når ejeren ikke allerede har
 * en seriøs booking-løsning (især IKKE Naturstyrelsen) og når
 * beskrivelsen viser tegn på at ejeren håndterer bookinger selv —
 * MobilePay, forening, kontakt-info osv.
 */

export type OutreachReviewStatus = "sent" | "replied" | "not_relevant" | "needs_research";

export interface OutreachReviewRow {
  shelter_id: string;
  status: OutreachReviewStatus;
  recipient_email: string | null;
  recipient_name: string | null;
  notes: string | null;
  sent_at: string | null;
  reviewed_at: string;
}

export interface OutreachCandidate {
  shelter: Shelter;
  score: number;
  category: "high" | "medium" | "low";
  /** Forslag til modtager-email — detekteret i beskrivelsen, ellers null. */
  recipientEmailSuggestion: string | null;
  /** Forslag til modtager-navn — typisk kommune + "Kommune" eller forenings-navn. */
  recipientNameSuggestion: string;
  signals: string[];
  negativeSignals: string[];
  excerpt: string;
  review: OutreachReviewRow | null;
}

// ─── Signal-detektion ────────────────────────────────────────────────────────

const STRONG_SIGNALS: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: "mobilepay", pattern: /\bmobilepay\b/i, weight: 8 },
  { label: "forening", pattern: /\bforening(en|er)?\b/i, weight: 6 },
  { label: "spejder", pattern: /\bspejder(ne|gruppe)?\b/i, weight: 5 },
  { label: "lodsejer/privat", pattern: /\b(lodsejer|privat\s+ejet|privat\s+plads)\b/i, weight: 6 },
  { label: "ring/kontakt", pattern: /\b(ring(es)?\s+til|kontakt(e|es)?)\b/i, weight: 4 },
  { label: "betaling", pattern: /\bbetal(es|ing|er)?\b/i, weight: 4 },
  { label: "reservation/booking-tekst", pattern: /\b(reserver(es|ing)?|book(es|ing|et)\s+(via|hos))\b/i, weight: 5 },
  { label: "pris i tekst", pattern: /\b\d{1,4}\s*(kr|dkk|kroner)\b/i, weight: 3 },
];

const URL_NEGATIVE: Array<{ label: string; pattern: RegExp; penalty: number }> = [
  // Naturstyrelsen er svær at konvertere — de har deres eget system.
  { label: "naturstyrelsen-booking", pattern: /book\.naturstyrelsen\.dk/i, penalty: 8 },
  { label: "udinaturen", pattern: /udinaturen\.dk/i, penalty: 5 },
  { label: "bookenshelter", pattern: /bookenshelter\.dk/i, penalty: 4 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

function buildExcerpt(text: string, anchorLabels: string[]): string {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  let anchorIdx = -1;
  for (const label of anchorLabels) {
    const idx = lowerText.indexOf(label.toLowerCase());
    if (idx >= 0) {
      anchorIdx = idx;
      break;
    }
  }
  if (anchorIdx === -1) return text.slice(0, 320).trim();
  const start = Math.max(0, anchorIdx - 100);
  const end = Math.min(text.length, anchorIdx + 220);
  return text.slice(start, end).trim();
}

function suggestRecipientName(shelter: Shelter): string {
  // Default: kommunenavn, fx "Randers Kommune". Falder tilbage til
  // shelter-titel hvis kommune mangler.
  const kommune = (shelter.kommune ?? "").trim();
  if (kommune && !/kommune/i.test(kommune)) return `${kommune} Kommune`;
  if (kommune) return kommune;
  return shelter.title || "Hej";
}

// ─── Hovedanalyse ───────────────────────────────────────────────────────────

export function analyzeOutreachCandidate(shelter: Shelter): OutreachCandidate | null {
  // Skip: allerede på ShelterDK's bookingsystem.
  if (isStructuredBookable(shelter) && Array.isArray(shelter.bookable_shelters) && shelter.bookable_shelters.length > 0) {
    return null;
  }

  const descHtml = shelter.description ?? "";
  const text = stripHtml(descHtml);
  const bookingUrl = (shelter.booking_url ?? "").toLowerCase();

  // Signal-detektion
  const signals: string[] = [];
  let signalScore = 0;
  for (const { label, pattern, weight } of STRONG_SIGNALS) {
    if (pattern.test(text)) {
      signals.push(label);
      signalScore += weight;
    }
  }

  const negativeSignals: string[] = [];
  let negativeScore = 0;
  for (const { label, pattern, penalty } of URL_NEGATIVE) {
    if (pattern.test(bookingUrl) || pattern.test(text)) {
      negativeSignals.push(label);
      negativeScore += penalty;
    }
  }

  // Bonus: ingen booking_url overhovedet, men har signaler → meget relevant
  const hasNoBookingUrl = !bookingUrl.trim();
  const baseScore = hasNoBookingUrl ? 5 : 0;

  // Bonus: email i beskrivelsen gør det meget nemmere at sende
  const detectedEmail = extractEmail(text);
  const emailBonus = detectedEmail ? 3 : 0;

  const score = baseScore + signalScore + emailBonus - negativeScore;

  // Skip helt: ingen relevante signaler OG har naturstyrelsen-booking
  if (score <= 0 && negativeSignals.includes("naturstyrelsen-booking")) {
    return null;
  }

  let category: "high" | "medium" | "low";
  if (score >= 10) category = "high";
  else if (score >= 4) category = "medium";
  else category = "low";

  return {
    shelter,
    score,
    category,
    recipientEmailSuggestion: detectedEmail,
    recipientNameSuggestion: suggestRecipientName(shelter),
    signals,
    negativeSignals,
    excerpt: buildExcerpt(text, [...signals, detectedEmail ?? ""]),
    review: null,
  };
}

export function mergeOutreachReviews(
  candidates: OutreachCandidate[],
  reviews: OutreachReviewRow[]
): OutreachCandidate[] {
  const reviewMap = new Map(reviews.map((r) => [r.shelter_id, r]));
  return candidates.map((c) => ({
    ...c,
    review: reviewMap.get(c.shelter.id) ?? null,
  }));
}

export function sortOutreachCandidates(candidates: OutreachCandidate[]): OutreachCandidate[] {
  return [...candidates].sort((a, b) => {
    // Ikke-gennemgået øverst, derefter score desc.
    const aPending = a.review ? 1 : 0;
    const bPending = b.review ? 1 : 0;
    if (aPending !== bPending) return aPending - bPending;
    if (b.score !== a.score) return b.score - a.score;
    return (a.shelter.title || "").localeCompare(b.shelter.title || "", "da");
  });
}

// ─── Template-rendering ─────────────────────────────────────────────────────

export interface OutreachTemplate {
  subject: string;
  body: string;
}

export interface OutreachContext {
  shelter_title: string;
  shelter_url: string;
  recipient_name: string;
}

export function renderOutreachTemplate(
  template: OutreachTemplate,
  ctx: OutreachContext
): { subject: string; body: string } {
  const replace = (str: string) =>
    str
      .replace(/\{shelter_title\}/g, ctx.shelter_title)
      .replace(/\{shelter_url\}/g, ctx.shelter_url)
      .replace(/\{recipient_name\}/g, ctx.recipient_name);
  return {
    subject: replace(template.subject),
    body: replace(template.body),
  };
}

/** Bygger den offentlige shelter-URL. Bruges som default {shelter_url}. */
export function buildShelterUrl(shelter: Shelter, origin: string): string {
  const slug = shelter.slug ?? shelter.id;
  return `${origin}/shelter/${encodeURIComponent(slug)}`;
}
