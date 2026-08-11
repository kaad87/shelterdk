/**
 * Pris som ejeren opkræver DIREKTE af gæsten, uden om ShelterDKs betalingsflow
 * (typisk MobilePay ved ankomst).
 *
 * Holdes skarpt adskilt fra `shelter_price_dkk`, som ER Stripe-opkrævningen:
 *   totalDkk = shelter_price_dkk + platformgebyr   (lib/stripe.ts)
 * Intet herfra må nogensinde indgå i den beregning. Modulet importerer derfor
 * bevidst ikke noget fra stripe.ts.
 */

export type OnsitePriceBasis = "per_person_per_night" | "per_night" | "per_booking";

export interface OnsitePrice {
  dkk: number;
  basis: OnsitePriceBasis;
  note: string | null;
}

/** Læser felterne fra en bookbar enhed. Returnerer null når ejeren ikke opkræver noget selv. */
export function readOnsitePrice(unit: {
  onsite_price_dkk?: number | null;
  onsite_price_basis?: string | null;
  onsite_payment_note?: string | null;
}): OnsitePrice | null {
  const dkk = unit.onsite_price_dkk;
  if (typeof dkk !== "number" || dkk <= 0) return null;
  const raw = unit.onsite_price_basis;
  const basis: OnsitePriceBasis =
    raw === "per_night" || raw === "per_booking" ? raw : "per_person_per_night";
  return { dkk, basis, note: unit.onsite_payment_note?.trim() || null };
}

/** Antal nætter mellem to ISO-datoer. Mindst 1, så en endagsbooking ikke bliver gratis. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

/** Hvad gæsten skal betale ejeren i alt. */
export function calculateOnsiteTotal(
  price: OnsitePrice,
  opts: { guests: number; nights: number }
): number {
  const guests = Math.max(1, Math.floor(opts.guests || 1));
  const nights = Math.max(1, Math.floor(opts.nights || 1));
  switch (price.basis) {
    case "per_booking":
      return price.dkk;
    case "per_night":
      return price.dkk * nights;
    default:
      return price.dkk * guests * nights;
  }
}

const BASIS_LABEL: Record<OnsitePriceBasis, string> = {
  per_person_per_night: "pr. person pr. nat",
  per_night: "pr. nat",
  per_booking: "pr. booking",
};

/** Kort prisangivelse til lister og paneler, fx "50 kr pr. person pr. nat". */
export function formatOnsitePrice(price: OnsitePrice): string {
  return `${price.dkk} kr ${BASIS_LABEL[price.basis]}`;
}

/**
 * Sætning til gæsten der gør det utvetydigt at beløbet IKKE opkræves af os.
 *
 * Formuleringen er det vigtigste i hele funktionen: booker gæsten, betaler 25 kr
 * i gebyr og møder op uden at vide at der skal 50 kr pr. person pr. nat op af
 * lommen, er det ejeren der står med den akavede samtale.
 */
export function describeOnsitePayment(
  price: OnsitePrice,
  opts?: { guests?: number; nights?: number }
): string {
  const base = `${formatOnsitePrice(price)} betales direkte til ejeren`;
  const via = price.note ? ` via ${price.note}` : " på stedet";
  if (opts?.guests && opts?.nights) {
    const total = calculateOnsiteTotal(price, {
      guests: opts.guests,
      nights: opts.nights,
    });
    const n = opts.nights === 1 ? "1 nat" : `${opts.nights} nætter`;
    const g = opts.guests === 1 ? "1 person" : `${opts.guests} personer`;
    return `${base}${via} — for ${g} i ${n} bliver det ${total} kr.`;
  }
  return `${base}${via}.`;
}
