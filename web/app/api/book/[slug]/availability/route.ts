import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterBySlug, getUnavailableDates } from "@/lib/booking-db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }
  const dates = await getUnavailableDates(shelter.id);
  return NextResponse.json({ dates });
}
