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

/**
 * Fallback-template hvis outreach_templates-tabellen ikke er migreret
 * endnu (fx ved testmail før migration). Holdes i sync med default-rækken
 * i migrations/20260527_outreach.sql.
 */
export const DEFAULT_OUTREACH_TEMPLATE: OutreachTemplate = {
  subject: "{shelter_title} – tilbud om gratis bookingsystem til jeres shelter",
  body: `Hej {recipient_name}

Jeg hedder Christian og driver platformen ShelterDK.dk. Vores mission er ret simpel: Vi vil skabe et samlet, overskueligt overblik over Danmarks mange shelters, så det bliver nemmere for danskerne at komme ud og nyde naturen. (Du kan evt. læse lidt mere om tankerne bag projektet i denne artikel fra Politiken): https://politiken.dk/rejser/art10803977/Holder-du-af-sheltere-er-det-her-m%C3%A5ske-nyheden-du-har-ventet-p%C3%A5

Jeg skriver til jer i dag, fordi vi har rigtig mange brugere, der kigger på jeres shelter: {shelter_url}

En af de absolut største frustrationer for friluftsfolk er frygten for at pakke rygsækken, vandre afsted, og så opdage, at shelteret allerede er optaget. Når vi fjerner den usikkerhed og lader folk booke på forhånd, oplever vi faktisk, at shelteret bliver brugt af endnu flere. Det tiltrækker nemlig dem, der ellers helt fravælger turen på grund af usikkerheden — for eksempel børnefamilier eller folk, der kommer langvejsfra.

Samtidig ved jeg, at mange shelter-ejere bruger meget tid på at besvare henvendelser om ledige datoer. For at løse det hele på en gang, har jeg bygget en simpel, brugervenlig booking-kalender, som I kan få lov at bruge helt uden omkostninger for jer. Nedenfor ser du et eksempel på en booking-side som vi har lavet for Geopark Odsherred og en demo-side for det ejer-dashboard som man får, hvor I har mulighed for at redigere jeres shelteroplysninger, hvilke beløb for evt. opkrævning, se bookinger osv.:

Booking-siden: https://shelterdk.dk/danmark/sjaelland-og-oeerne/odsherred/shelterplads-ved-solvognens-fundsted-11573
Ejer-dashboardet (din side): https://shelterdk.dk/demo/ejer

Du kan klikke rundt i begge links og se præcis, hvad en gæst oplever, og hvad du som ejer ser.

Her er hvad systemet gør for jer i praksis:

- Gæsten booker via system: Gennem vores system kan brugere booke shelteret ud i fremtiden.
- Du godkender eller afviser: Du beholder fuld kontrol. Systemet sender bare besked og lukker datoerne automatisk.
- Eller: Hvis man foretrækker det, kan systemet også sættes op, så gæsten booker med det samme uden at vente på godkendelse. Det er allerede indbygget — vi vælger bare, hvad der passer jer bedst.
- Kalendersynkronisering: Bookinger fra systemet opdaterer automatisk jeres kalender, hvis det ønskes, og manuelle bookinger I selv laver blokerer datoerne online.
- Besked-system: Mulighed for at kommunikere med den besøgende ved at sende beskeder frem og tilbage på en fast platform.
- Autogenerede beskeder: Systemet sender autogenerede beskeder baseret på dit shelter og specifikke ønsker i beskeden.

Systemet er også fleksibelt i forhold til, hvor bookingen skal ligge. Vil I have det på jeres egen hjemmeside, sætter vi det ind der som et lille vindue — gæsten behøver aldrig forlade jeres side. Foretrækker I at bookingen ligger på ShelterDK.dk, kan vi også det. Begge løsninger er allerede bygget og klar.

For at systemet kan køre rundt, er det skruet sådan sammen, at det koster brugeren et lille bookinggebyr. Det gør vi af to årsager:

1. Det dækker mine udgifter til at udvikle og drive det bagvedliggende IT-system.
2. Det minimerer "no-shows". Erfaringen viser, at hvis bookinger er 100 % gratis, har folk en tendens til at booke mange weekender langt ud i fremtiden "bare for at være sikre" — for derefter ikke at dukke op. Det er lige nu et kæmpe problem. Et lille gebyr gør bookingen forpligtende, så jeres shelter ikke står tomt til gene for andre.

For at gøre det hele så enkelt som muligt for jeres gæster arbejder jeg på at producere fysiske skilte til de shelters, der er med i systemet. Skiltet hænges op på shelteret og fortæller besøgende, at stedet skal bookes med en QR-kode der tager dem direkte til booking-siden. På den måde undgår vi situationen, hvor en gæst der har booket og rejst langt, ankommer til et shelter der allerede er optaget af nogen, som ikke var klar over at stedet skal bookes på forhånd.

Det blev lidt langt! Beklager — men prøv demoen, hvis du har lyst, og fortæl mig hvad du tænker. Helt uforpligtende.

Med venlig hilsen
Christian
ShelterDK.dk`,
};

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
