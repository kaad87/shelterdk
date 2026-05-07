import { NextRequest, NextResponse } from "next/server";
import { getBookingsForShelter } from "@/lib/booking-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const bookings = await getBookingsForShelter(context.shelter.id);
  return NextResponse.json({ bookings, shelter: context.shelter });
}
