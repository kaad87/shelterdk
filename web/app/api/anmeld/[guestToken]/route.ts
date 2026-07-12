import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getBookingByGuestToken } from "@/lib/booking-db";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Gæste-anmeldelse efter ophold. Auth = guest_token (samme model som
 * /min-booking). Kun bekræftede bookinger med overstået check-out; én
 * anmeldelse pr. booking (DB-unik på booking_id).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guestToken: string }> }
) {
  const rateLimited = await enforcePublicRateLimit(req, {
    scope: "guest_review",
    windowSeconds: 3600,
    maxHits: 10,
    errorMessage: "For mange forsøg. Prøv igen om lidt.",
  });
  if (rateLimited) return rateLimited;

  const { guestToken } = await params;
  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) {
    return NextResponse.json({ error: "Booking ikke fundet" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Kun bekræftede ophold kan anmeldes" },
      { status: 422 }
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (booking.check_out > today) {
    return NextResponse.json(
      { error: "Du kan anmelde opholdet efter din afrejse" },
      { status: 422 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Vælg 1-5 stjerner" }, { status: 400 });
  }
  const rawComment = typeof b.comment === "string" ? b.comment.trim() : "";
  if (rawComment.length > 1000) {
    return NextResponse.json(
      { error: "Kommentaren må højst være 1000 tegn" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // shelter_id denormaliseres fra unit'en til visning på den offentlige side.
  const { data: unit } = await admin
    .from("bookable_shelters")
    .select("shelter_id")
    .eq("id", booking.bookable_shelter_id)
    .single();

  const { error } = await admin.from("shelter_guest_reviews").insert({
    booking_id: booking.id,
    bookable_shelter_id: booking.bookable_shelter_id,
    shelter_id: unit?.shelter_id ?? null,
    rating,
    comment: rawComment || null,
    guest_name: booking.guest_name,
  });

  if (error) {
    // 23505 = unique_violation → allerede anmeldt
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Du har allerede anmeldt dette ophold" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
