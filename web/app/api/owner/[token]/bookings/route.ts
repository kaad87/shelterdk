import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken, getBookingsForShelter } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  const bookings = await getBookingsForShelter(shelter.id);
  return NextResponse.json({ bookings, shelter });
}
