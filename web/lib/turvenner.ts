// lib/turvenner.ts

export interface TripPost {
  id: string;
  slug: string;
  author_name: string;
  title: string;
  description: string;
  trip_date: string | null;
  spots_available: number;
  region: string;
  shelter_id: string | null;
  expires_at: string;
  status: string;
  created_at: string;
}

export interface CreateTripPostInput {
  author_name: string;
  author_email: string;
  title: string;
  description: string;
  trip_date?: string;
  spots_available: number;
  region: string;
  shelter_id?: string;
  honeypot?: string;
}

export interface ContactInput {
  sender_name: string;
  sender_email: string;
  message: string;
  honeypot?: string;
}

export const REGIONS = [
  "Nordjylland",
  "Midtjylland",
  "Sønderjylland",
  "Vestjylland",
  "Østjylland",
  "Fyn",
  "Nordsjælland",
  "Sydsjælland",
  "Vestsjælland",
  "Lolland-Falster",
  "Bornholm",
  "Hovedstaden",
] as const;

export type Region = (typeof REGIONS)[number];

const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.com\b/i,
  /\.dk\b/i,
  /køb\s/i,
  /gratis\s.*penge/i,
  /viagra/i,
  /casino/i,
  /crypto/i,
];

export function isSpam(text: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(text));
}

export function validateCreateInput(
  input: Partial<CreateTripPostInput>
): string | null {
  if (input.honeypot) return "spam";

  const name = input.author_name?.trim();
  if (!name || name.length < 2 || name.length > 60)
    return "Navn skal være mellem 2 og 60 tegn.";

  const email = input.author_email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Ugyldig email.";

  const title = input.title?.trim();
  if (!title || title.length < 5 || title.length > 100)
    return "Titel skal være mellem 5 og 100 tegn.";

  const desc = input.description?.trim();
  if (!desc || desc.length < 10 || desc.length > 500)
    return "Beskrivelse skal være mellem 10 og 500 tegn.";

  if (isSpam(title) || isSpam(desc))
    return "Opslaget indeholder ikke-tilladt indhold.";

  const spots = input.spots_available;
  if (!spots || spots < 1 || spots > 10)
    return "Antal pladser skal være mellem 1 og 10.";

  const region = input.region;
  if (!region || !REGIONS.includes(region as Region))
    return "Vælg en gyldig region.";

  if (input.trip_date) {
    const d = new Date(input.trip_date);
    if (isNaN(d.getTime())) return "Ugyldig dato.";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return "Turdato kan ikke være i fortiden.";
  }

  return null;
}

export function validateContactInput(
  input: Partial<ContactInput>
): string | null {
  if (input.honeypot) return "spam";

  const name = input.sender_name?.trim();
  if (!name || name.length < 2 || name.length > 60)
    return "Navn skal være mellem 2 og 60 tegn.";

  const email = input.sender_email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Ugyldig email.";

  const msg = input.message?.trim();
  if (!msg || msg.length < 10 || msg.length > 1000)
    return "Besked skal være mellem 10 og 1000 tegn.";

  if (isSpam(msg)) return "Beskeden indeholder ikke-tilladt indhold.";

  return null;
}

export function generateSlug(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function computeExpiresAt(tripDate?: string): string {
  if (tripDate) {
    const d = new Date(tripDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
