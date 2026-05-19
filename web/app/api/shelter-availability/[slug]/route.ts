import { NextRequest, NextResponse } from "next/server";
import { getShelterAvailabilityBySlug } from "@/lib/external-availability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const availability = await getShelterAvailabilityBySlug(slug);

  if (!availability) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  return NextResponse.json(availability, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
