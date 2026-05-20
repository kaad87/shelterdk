import { createHash, createHmac, timingSafeEqual } from "crypto";

type PaymentAccessPayload = {
  scope: "payment";
  bid: string;
  fp: string;
  exp: number;
};

const DEFAULT_PAYMENT_ACCESS_TTL_SECONDS = 36 * 60 * 60;

function getBookingAccessSecret(): string {
  // Keep a separate env var available for payment-link rotation.
  // ADMIN_SECRET remains as a backwards-compatible fallback until all
  // environments have BOOKING_ACCESS_SECRET configured explicitly.
  const secret =
    process.env.BOOKING_ACCESS_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim();

  if (!secret) {
    throw new Error("BOOKING_ACCESS_SECRET eller ADMIN_SECRET er påkrævet");
  }

  return `booking-access:${secret}`;
}

function fingerprintGuestToken(guestToken: string): string {
  return createHash("sha256")
    .update(`payment:${guestToken}`)
    .digest("hex")
    .slice(0, 24);
}

function signEncodedPayload(encodedPayload: string): string {
  return createHmac("sha256", getBookingAccessSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createPaymentAccessToken(
  booking: { id: string; guest_token: string },
  ttlSeconds = DEFAULT_PAYMENT_ACCESS_TTL_SECONDS
): string {
  const payload: PaymentAccessPayload = {
    scope: "payment",
    bid: booking.id,
    fp: fingerprintGuestToken(booking.guest_token),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = signEncodedPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyPaymentAccessToken(
  token: string,
  booking: { id: string; guest_token: string }
): boolean {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return false;

  const expectedSignature = signEncodedPayload(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) return false;
  if (!timingSafeEqual(provided, expected)) return false;

  let payload: PaymentAccessPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as PaymentAccessPayload;
  } catch {
    return false;
  }

  if (payload.scope !== "payment") return false;
  if (payload.bid !== booking.id) return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;

  return payload.fp === fingerprintGuestToken(booking.guest_token);
}
