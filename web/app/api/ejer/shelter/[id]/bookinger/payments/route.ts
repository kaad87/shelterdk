import { NextRequest, NextResponse } from "next/server";
import { getBookingsForShelter } from "@/lib/booking-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const bookings = await getBookingsForShelter(context.shelter.id);
  if (bookings.length === 0) return NextResponse.json([]);

  const bookingIds = bookings.map((b) => b.id);
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("booking_id, status, amount_total_dkk, amount_shelter_dkk, amount_platform_dkk")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const deduped = (data ?? []).filter((p: { booking_id: string }) => {
    if (seen.has(p.booking_id)) return false;
    seen.add(p.booking_id);
    return true;
  });

  return NextResponse.json(deduped);
}
