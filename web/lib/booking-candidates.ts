import type { Shelter, ShelterBookingLinkMode, ShelterBookingProvider } from "@/types/shelter";
import { isStructuredBookable, inferProviderFromUrl, getBookingLookupKeyFromUrl } from "@shared/lib/shelter-detail";

export type BookingCandidateReviewStatus =
  | "booking_found"
  | "contact_only"
  | "not_bookable"
  | "needs_manual";

export interface BookingCandidateReviewRow {
  shelter_id: string;
  status: BookingCandidateReviewStatus;
  notes: string | null;
  reviewed_booking_url: string | null;
  reviewed_at: string;
}

export interface BookingCandidate {
  shelter: Shelter;
  score: number;
  likelyBookable: boolean;
  suggestedBookingUrl: string | null;
  foundBookingUrls: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  excerpt: string;
  review: BookingCandidateReviewRow | null;
}

const POSITIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "kan bookes", pattern: /\bkan\s+bookes\b/i },
  { label: "bookes her", pattern: /\bbookes\s+her\b/i },
  { label: "bookes via", pattern: /\bbookes\s+via\b/i },
  { label: "book naturen", pattern: /\bbook\s+naturen\b/i },
  { label: "reservation", pattern: /\breservation(er)?\b/i },
  { label: "reserver", pattern: /\breserver(es|ing)?\b/i },
  { label: "betaling", pattern: /\bbetaling\b/i },
  { label: "betal", pattern: /\bbetal(es|ing)?\b/i },
  { label: "mobilepay", pattern: /\bmobilepay\b/i },
  { label: "udinaturen", pattern: /\budinaturen\b/i },
  { label: "naturstyrelsen", pattern: /\bbook\.naturstyrelsen\.dk\b/i },
  { label: "bookenshelter", pattern: /\bbookenshelter\.dk\b/i },
  { label: "shelterbooking", pattern: /\bshelterbooking\b/i },
];

const NEGATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "kan ikke bookes", pattern: /\bkan\s+ikke\s+bookes\b/i },
  { label: "kan ikke reserveres", pattern: /\bkan\s+ikke\s+reserveres\b/i },
  { label: "ikke bookbar", pattern: /\bikke\s+bookbar\b/i },
  { label: "først-til-mølle", pattern: /\bførst[\s-]*til[\s-]*mølle\b/i },
  { label: "foerst-til-moelle", pattern: /\bfoerst[\s-]*til[\s-]*moelle\b/i },
];

const POSITIVE_URL_HINTS = [
  "book.naturstyrelsen.dk",
  "udinaturen.dk",
  "bookenshelter.dk",
  "shelterbooking.",
  "booknaturen.",
  "booking.",
  "book.",
];

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUrls(html: string): string[] {
  const found = new Set<string>();
  const decoded = decodeHtml(html);
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  for (const match of decoded.matchAll(hrefRegex)) {
    const url = match[1]?.trim();
    if (url && /^https?:\/\//i.test(url)) found.add(url);
  }
  const rawUrlRegex = /\bhttps?:\/\/[^\s<>"']+/gi;
  for (const match of decoded.matchAll(rawUrlRegex)) {
    const url = match[0]?.trim();
    if (url) found.add(url);
  }
  return [...found];
}

function looksLikeBookingUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return POSITIVE_URL_HINTS.some((hint) => normalized.includes(hint));
}

function buildExcerpt(text: string, signals: string[]): string {
  if (!text) return "";
  const anchor = signals[0]?.toLowerCase() ?? "";
  const index = anchor ? text.toLowerCase().indexOf(anchor) : -1;
  if (index === -1) return text.slice(0, 320).trim();
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + 220);
  return text.slice(start, end).trim();
}

export function stripBookingCandidateHtml(html: string): string {
  return stripHtml(html);
}

export function buildBookingCandidateExcerpt(text: string, signals: string[]): string {
  return buildExcerpt(text, signals);
}

export function analyzeBookingCandidate(shelter: Shelter): BookingCandidate | null {
  if (isStructuredBookable(shelter)) return null;

  const descriptionHtml = shelter.description ?? "";
  if (!descriptionHtml.trim()) return null;

  const text = stripHtml(descriptionHtml);
  const urls = extractUrls(descriptionHtml);
  const foundBookingUrls = urls.filter(looksLikeBookingUrl);
  const positiveSignals = POSITIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  const negativeSignals = NEGATIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);

  const positiveScore = foundBookingUrls.length * 5 + positiveSignals.length * 2;
  const negativeScore = negativeSignals.length * 4;
  const score = positiveScore - negativeScore;

  const likelyBookable =
    foundBookingUrls.length > 0 ||
    (positiveSignals.length > 0 && !(negativeSignals.length > 0 && foundBookingUrls.length === 0));

  if (!likelyBookable) return null;

  return {
    shelter,
    score,
    likelyBookable,
    suggestedBookingUrl: foundBookingUrls[0] ?? null,
    foundBookingUrls,
    positiveSignals,
    negativeSignals,
    excerpt: buildExcerpt(text, [...positiveSignals, ...foundBookingUrls]),
    review: null,
  };
}

export function mergeBookingCandidateReviews(
  candidates: BookingCandidate[],
  reviews: BookingCandidateReviewRow[]
): BookingCandidate[] {
  const reviewMap = new Map(reviews.map((review) => [review.shelter_id, review]));
  return candidates.map((candidate) => ({
    ...candidate,
    review: reviewMap.get(candidate.shelter.id) ?? null,
  }));
}

export function sortBookingCandidates(candidates: BookingCandidate[]): BookingCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.foundBookingUrls.length !== a.foundBookingUrls.length) {
      return b.foundBookingUrls.length - a.foundBookingUrls.length;
    }
    return a.shelter.title.localeCompare(b.shelter.title, "da");
  });
}

export function inferManualBookingUpdate(input: {
  bookingUrl?: string | null;
  provider?: ShelterBookingProvider | null;
  notes?: string | null;
}): {
  booking_url: string | null;
  booking_provider: ShelterBookingProvider | null;
  booking_link_mode: ShelterBookingLinkMode;
  booking_lookup_key: string | null;
  booking_confidence: "manual";
  booking_url_verified_at: string | null;
} {
  const bookingUrl = (input.bookingUrl ?? "").trim() || null;
  const provider = input.provider ?? inferProviderFromUrl(bookingUrl) ?? "private";
  const linkMode: ShelterBookingLinkMode = bookingUrl ? "external_direct" : "contact_only";
  return {
    booking_url: bookingUrl,
    booking_provider: provider,
    booking_link_mode: linkMode,
    booking_lookup_key: getBookingLookupKeyFromUrl(bookingUrl),
    booking_confidence: "manual",
    booking_url_verified_at: bookingUrl ? new Date().toISOString() : null,
  };
}
