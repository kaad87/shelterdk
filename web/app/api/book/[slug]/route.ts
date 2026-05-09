import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterBySlug,
  createBooking,
  createActionTokens,
  hasUnavailableOverlap,
  cancelPendingBooking,
  BookingConflictError,
} from "@/lib/booking-db";
import {
  sendBookingRequestToOwner,
  sendBookingReceivedToGuest,
} from "@/lib/booking-email";
import {
  createCheckoutSession,
  calculateBookingAmounts,
  calculateBookingNights,
} from "@/lib/stripe";
import { createBookingPayment } from "@/lib/payment-db";
import { sendGa4Event } from "@/lib/server-analytics";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-config";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const guest_name = typeof b.guest_name === "string" ? b.guest_name.trim() : "";
  const guest_email = typeof b.guest_email === "string" ? b.guest_email.trim().toLowerCase() : "";
  const guest_count = typeof b.guest_count === "number" ? b.guest_count : 0;
  const check_in = typeof b.check_in === "string" ? b.check_in.trim() : "";
  const check_out = typeof b.check_out === "string" ? b.check_out.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 500) : null;
  const accepted_terms = b.accepted_terms === true;

  // Validation
  if (!guest_name || guest_name.length > 100)
    return NextResponse.json({ error: "Ugyldigt navn (1–100 tegn)" }, { status: 400 });
  if (!EMAIL_RE.test(guest_email))
    return NextResponse.json({ error: "Ugyldig email" }, { status: 400 });
  if (!Number.isInteger(guest_count) || guest_count < 1 || guest_count > shelter.max_persons)
    return NextResponse.json(
      { error: `Antal skal være 1–${shelter.max_persons}` },
      { status: 400 }
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out))
    return NextResponse.json({ error: "Ugyldigt datoformat (YYYY-MM-DD)" }, { status: 400 });
  const inDate = new Date(check_in);
  const outDate = new Date(check_out);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()))
    return NextResponse.json({ error: "Ugyldige datoer" }, { status: 400 });
  if (check_in >= check_out)
    return NextResponse.json({ error: "Afrejsedato skal være efter ankomstdato" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (check_in < today)
    return NextResponse.json({ error: "Ankomstdato kan ikke være i fortiden" }, { status: 400 });
  const latestAllowedCheckIn = new Date(Date.now() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (check_in > latestAllowedCheckIn || check_out > latestAllowedCheckIn) {
    return NextResponse.json(
      { error: `Du kan højst booke ${BOOKING_WINDOW_DAYS} dage frem.` },
      { status: 400 }
    );
  }
  if (!accepted_terms)
    return NextResponse.json(
      { error: "Du skal acceptere bookingvilkårene og læse privatlivspolitikken" },
      { status: 400 }
    );

  try {
    // Server-side guard: do not rely solely on client availability data.
    const conflict = await hasUnavailableOverlap(shelter.id, check_in, check_out, {
      includePending: true,
    });
    if (conflict)
      return NextResponse.json(
        { error: "Disse datoer er desværre ikke længere ledige" },
        { status: 409 }
      );

    const booking = await createBooking({
      bookable_shelter_id: shelter.id,
      guest_name,
      guest_email,
      guest_count,
      check_in,
      check_out,
      message: message || null,
    });

    // For after_confirmation: notify owner + send guest receipt immediately
    // For upfront: skip — emails are sent by the Stripe webhook after payment
    if (shelter.payment_mode !== "upfront") {
      const { confirmToken, rejectToken } = await createActionTokens(booking.id);
      try {
        await Promise.all([
          sendBookingRequestToOwner({
            ownerEmail: shelter.owner_email,
            shelterTitle: shelter.title,
            ownerToken: shelter.owner_token,
            guestName: guest_name,
            guestEmail: guest_email,
            guestCount: guest_count,
            checkIn: check_in,
            checkOut: check_out,
            message: message || null,
            confirmToken,
            rejectToken,
          }),
          sendBookingReceivedToGuest({
            guestEmail: guest_email,
            guestName: guest_name,
            shelterTitle: shelter.title,
            checkIn: check_in,
            checkOut: check_out,
            guestToken: booking.guest_token,
          }),
        ]);
      } catch (err) {
        console.error("book route: non-fatal booking email error:", err);
      }
    }

    // For upfront shelters: create Stripe checkout session immediately
    let checkoutUrl: string | undefined;
    let amountTotalDkk: number | undefined;
    if (shelter.payment_mode === "upfront") {
      try {
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        const { shelterDkk, platformDkk, totalDkk } = calculateBookingAmounts({
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          shelterPriceDkk: shelter.shelter_price_dkk,
          feePct: shelter.platform_fee_pct,
          feeMinDkk: shelter.platform_fee_min_dkk,
        });
        amountTotalDkk = totalDkk;
        await createBookingPayment({
          bookingId: booking.id,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        checkoutUrl = url;
      } catch (err) {
        console.error("book route: upfront checkout error:", err);
        await cancelPendingBooking(booking.id).catch((cancelErr) => {
          console.error("book route: failed to cancel pending booking after checkout error:", cancelErr);
        });
        return NextResponse.json(
          { error: "Kunne ikke starte betalingen. Prøv igen om et øjeblik." },
          { status: 500 }
        );
      }
    }

    const referrer = req.headers.get("referer") ?? undefined;
    try {
      await sendGa4Event({
        headers: req.headers,
        eventName: "booking_request_submitted",
        path: referrer,
        referrer,
        eventParams: {
          shelter_slug: slug,
          payment_mode: shelter.payment_mode,
          guest_count,
          nights: calculateBookingNights(check_in, check_out),
          has_message: Boolean(message),
          checkout_ready: Boolean(checkoutUrl),
        },
      });
    } catch (err) {
      console.error("book route: non-fatal analytics error:", err);
    }

    if (checkoutUrl && amountTotalDkk !== undefined) {
      try {
        await sendGa4Event({
          headers: req.headers,
          eventName: "payment_started",
          path: referrer,
          referrer,
          eventParams: {
            booking_id: booking.id,
            shelter_slug: slug,
            payment_mode: shelter.payment_mode,
            amount_total_dkk: amountTotalDkk,
            payment_context: "upfront_booking",
          },
        });
      } catch (err) {
        console.error("book route: non-fatal payment analytics error:", err);
      }
    }

    return NextResponse.json(
      { ok: true, bookingId: booking.id, guestToken: booking.guest_token, checkoutUrl },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.json(
        { error: "Disse datoer er desværre ikke længere ledige" },
        { status: 409 }
      );
    }
    console.error("booking create error:", err);
    return NextResponse.json(
      { error: "Noget gik galt. Prøv igen." },
      { status: 500 }
    );
  }
}
