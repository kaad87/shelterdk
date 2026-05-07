import { NextRequest } from "next/server";
import { generateIcal } from "@/lib/ical-exporter";
import { getBookingsForShelter, getBlockedDatesWithSource } from "@/lib/booking-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return new Response("Uautoriseret", { status: 401 });

  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(context.shelter.id),
    getBlockedDatesWithSource(context.shelter.id),
  ]);

  const icsText = generateIcal(context.shelter.title, bookings, blockedDates);

  return new Response(icsText, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shelter-${context.shelter.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
