import Stripe from "stripe";
import type { ShelterBooking, BookableShelter } from "@/types/booking";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/**
 * Calculate fee breakdown. All amounts are whole DKK.
 * Formula: platformDkk = max(round(priceDkk × feePct / 100), feeMinDkk)
 *
 * Note: return type is intentionally richer than the spec's Promise<string>
 * because callers also need the sessionId to insert into booking_payments.
 */
export function calculateFee(
  priceDkk: number,
  feePct: number,
  feeMinDkk: number
): { shelterDkk: number; platformDkk: number; totalDkk: number } {
  const shelterDkk = priceDkk;
  const platformDkk = Math.max(Math.round(priceDkk * feePct / 100), feeMinDkk);
  return { shelterDkk, platformDkk, totalDkk: shelterDkk + platformDkk };
}

/**
 * Create a Stripe Checkout Session for a booking.
 * Returns { url, sessionId } — url to redirect guest, sessionId to store in DB.
 * Note: expires_at maximum is 24h from now (Stripe limit).
 */
export async function createCheckoutSession(
  booking: ShelterBooking,
  shelter: BookableShelter
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const priceDkk = shelter.shelter_price_dkk ?? 0;
  const { shelterDkk, platformDkk } = calculateFee(
    priceDkk,
    shelter.platform_fee_pct,
    shelter.platform_fee_min_dkk
  );

  const lineItems: any[] = [];

  if (shelterDkk > 0) {
    lineItems.push({
      price_data: {
        currency: "dkk",
        product_data: { name: `Overnatning: ${shelter.title}` },
        unit_amount: shelterDkk * 100, // øre
      },
      quantity: 1,
    });
  }

  lineItems.push({
    price_data: {
      currency: "dkk",
      product_data: { name: "Administrationsgebyr (ShelterDK)" },
      unit_amount: platformDkk * 100, // øre
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["mobilepay", "card"],
    line_items: lineItems,
    metadata: { booking_id: booking.id },
    success_url: `${SITE_URL}/booking/${booking.id}/tak`,
    cancel_url: `${SITE_URL}/booking/${booking.id}/betal`,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  });

  if (!session.url) throw new Error("Stripe session created but no URL returned");
  return { url: session.url, sessionId: session.id };
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
