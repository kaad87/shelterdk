import Stripe from "stripe";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

const VAT_DIVISOR = 1.25;

/**
 * Interpret platform fee amounts as gross DKK incl. VAT.
 * Example: 50 kr gross => 40 kr net + 10 kr VAT.
 */
export function calculateVatIncludedBreakdown(grossDkk: number): {
  grossDkk: number;
  netDkk: number;
  vatDkk: number;
} {
  const netDkk = Math.round((grossDkk / VAT_DIVISOR) * 100) / 100;
  const vatDkk = Math.round((grossDkk - netDkk) * 100) / 100;
  return { grossDkk, netDkk, vatDkk };
}

/**
 * Calculate fee breakdown. All chargeable amounts are whole DKK shown to the guest.
 * Formula: platformGrossDkk = max(round(priceDkk × feePct / 100), feeMinDkk)
 * The resulting platform fee is treated as a gross amount incl. VAT.
 */
export function calculateFee(
  priceDkk: number,
  feePct: number,
  feeMinDkk: number
): {
  shelterDkk: number;
  platformDkk: number;
  platformNetDkk: number;
  platformVatDkk: number;
  totalDkk: number;
} {
  const shelterDkk = priceDkk;
  const platformDkk = Math.max(Math.round(priceDkk * feePct / 100), feeMinDkk);
  const { netDkk: platformNetDkk, vatDkk: platformVatDkk } = calculateVatIncludedBreakdown(platformDkk);
  return { shelterDkk, platformDkk, platformNetDkk, platformVatDkk, totalDkk: shelterDkk + platformDkk };
}

export function calculateBookingNights(
  checkIn: string,
  checkOut: string
): number {
  return Math.max(
    1,
    Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
    )
  );
}

export function calculateBookingAmounts(opts: {
  checkIn: string;
  checkOut: string;
  shelterPriceDkk: number | null;
  feePct: number;
  feeMinDkk: number;
}): {
  nights: number;
  shelterDkk: number;
  platformDkk: number;
  platformNetDkk: number;
  platformVatDkk: number;
  totalDkk: number;
} {
  const nights = calculateBookingNights(opts.checkIn, opts.checkOut);
  const shelterTotalDkk = (opts.shelterPriceDkk ?? 0) * nights;
  const { shelterDkk, platformDkk, platformNetDkk, platformVatDkk, totalDkk } = calculateFee(
    shelterTotalDkk,
    opts.feePct,
    opts.feeMinDkk
  );

  return { nights, shelterDkk, platformDkk, platformNetDkk, platformVatDkk, totalDkk };
}

export function resolveBookingAmounts(
  booking: Pick<ShelterBooking, "check_in" | "check_out" | "quoted_shelter_dkk" | "quoted_platform_dkk" | "quoted_total_dkk">,
  shelter: Pick<BookableShelter, "shelter_price_dkk" | "platform_fee_pct" | "platform_fee_min_dkk">
): {
  nights: number;
  shelterDkk: number;
  platformDkk: number;
  platformNetDkk: number;
  platformVatDkk: number;
  totalDkk: number;
  isSnapshot: boolean;
} {
  if (
    typeof booking.quoted_shelter_dkk === "number" &&
    typeof booking.quoted_platform_dkk === "number" &&
    typeof booking.quoted_total_dkk === "number"
  ) {
    const { netDkk: platformNetDkk, vatDkk: platformVatDkk } = calculateVatIncludedBreakdown(
      booking.quoted_platform_dkk
    );
    return {
      nights: calculateBookingNights(booking.check_in, booking.check_out),
      shelterDkk: booking.quoted_shelter_dkk,
      platformDkk: booking.quoted_platform_dkk,
      platformNetDkk,
      platformVatDkk,
      totalDkk: booking.quoted_total_dkk,
      isSnapshot: true,
    };
  }

  return {
    ...calculateBookingAmounts({
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      shelterPriceDkk: shelter.shelter_price_dkk,
      feePct: shelter.platform_fee_pct,
      feeMinDkk: shelter.platform_fee_min_dkk,
    }),
    isSnapshot: false,
  };
}

/**
 * Create a Stripe Checkout Session for a booking.
 * Returns { url, sessionId } — url to redirect guest, sessionId to store in DB.
 * Note: expires_at maximum is 24h from now (Stripe limit).
 */
export async function createCheckoutSession(
  booking: ShelterBooking,
  shelter: BookableShelter,
  amountsOverride?: {
    shelterDkk: number;
    platformDkk: number;
  }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const pricePerNightDkk = shelter.shelter_price_dkk ?? 0;
  const { nights, shelterDkk, platformDkk, isSnapshot } = resolveBookingAmounts(booking, shelter);
  const resolvedShelterDkk = amountsOverride?.shelterDkk ?? shelterDkk;
  const resolvedPlatformDkk = amountsOverride?.platformDkk ?? platformDkk;
  const useSnapshotPricing =
    Boolean(amountsOverride) || isSnapshot;

  const lineItems: any[] = [];

  if (resolvedShelterDkk > 0) {
    lineItems.push({
      price_data: {
        currency: "dkk",
        product_data: { name: `Overnatning: ${shelter.title}` },
        unit_amount: useSnapshotPricing ? resolvedShelterDkk * 100 : pricePerNightDkk * 100,
      },
      quantity: useSnapshotPricing ? 1 : nights,
    });
  }

  lineItems.push({
    price_data: {
      currency: "dkk",
      product_data: { name: "Administrationsgebyr inkl. moms (ShelterDK)" },
      unit_amount: resolvedPlatformDkk * 100, // øre
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    locale: "da",
    line_items: lineItems,
    metadata: { booking_id: booking.id },
    success_url: `${SITE_URL}/booking/${booking.id}/tak?t=${encodeURIComponent(booking.guest_token)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/booking/${booking.id}/betal?t=${encodeURIComponent(booking.guest_token)}`,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  });

  if (!session.url) throw new Error("Stripe session created but no URL returned");
  return { url: session.url, sessionId: session.id };
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

/**
 * Expire an open Stripe Checkout Session.
 * Non-open sessions cannot be expired and are ignored.
 */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  const stripe = getStripe();
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("cannot be expired") ||
      message.includes("already completed") ||
      message.includes("already expired")
    ) {
      return;
    }
    throw err;
  }
}

/**
 * Verify and construct a Stripe webhook event.
 * `body` MUST be the raw request body string — do NOT pass parsed JSON.
 */
export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(body, signature, secret);
}
