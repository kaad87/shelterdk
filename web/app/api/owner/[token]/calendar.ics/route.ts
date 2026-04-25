import { NextRequest } from "next/server";
import {
  getBookableShelterByOwnerToken,
  getBookingsForShelter,
  getBlockedDatesWithSource,
} from "@/lib/booking-db";
import { generateIcal } from "@/lib/ical-exporter";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return new Response("Not found", { status: 404 });

  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesWithSource(shelter.id),
  ]);

  const icsText = generateIcal(shelter.title, bookings, blockedDates);

  return new Response(icsText, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shelter-${shelter.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
