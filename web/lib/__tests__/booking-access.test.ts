import { describe, expect, it } from "vitest";
import {
  createPaymentAccessToken,
  verifyPaymentAccessToken,
} from "@/lib/booking-access";

describe("booking access token", () => {
  const booking = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    guest_token: "123e4567-e89b-12d3-a456-426614174001",
  };

  it("verifies a freshly created payment access token", () => {
    process.env.ADMIN_SECRET = "test-secret";
    const token = createPaymentAccessToken(booking, 3600);
    expect(verifyPaymentAccessToken(token, booking)).toBe(true);
  });

  it("rejects a token for another booking", () => {
    process.env.ADMIN_SECRET = "test-secret";
    const token = createPaymentAccessToken(booking, 3600);
    expect(
      verifyPaymentAccessToken(token, {
        id: "123e4567-e89b-12d3-a456-426614174999",
        guest_token: booking.guest_token,
      })
    ).toBe(false);
  });

  it("rejects an expired token", () => {
    process.env.ADMIN_SECRET = "test-secret";
    const token = createPaymentAccessToken(booking, -1);
    expect(verifyPaymentAccessToken(token, booking)).toBe(false);
  });

  it("rejects a token for another guest token on the same booking id", () => {
    process.env.ADMIN_SECRET = "test-secret";
    const token = createPaymentAccessToken(booking, 3600);
    expect(
      verifyPaymentAccessToken(token, {
        id: booking.id,
        guest_token: "123e4567-e89b-12d3-a456-426614174777",
      })
    ).toBe(false);
  });

  it("rejects a payload with a tampered signature", () => {
    process.env.ADMIN_SECRET = "test-secret";
    const token = createPaymentAccessToken(booking, 3600);
    const [encodedPayload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        scope: "payment",
        bid: booking.id,
        fp: "deadbeefdeadbeefdeadbeef",
        exp: Math.floor(Date.now() / 1000) + 7200,
      })
    ).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${signature ?? encodedPayload}`;

    expect(verifyPaymentAccessToken(tamperedToken, booking)).toBe(false);
  });
});
