import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken } from "@/lib/booking-db";
import { getUnreadCountsForShelter } from "@/lib/messages-db";

export const dynamic = "force-dynamic";

/** GET /api/owner/[token]/unread-counts
 *  Returns { counts: Record<bookingId, unreadCount> } for all active bookings
 *  of the owner's shelter. Only counts unread guest messages. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  const counts = await getUnreadCountsForShelter(shelter.id);
  return NextResponse.json({ counts });
}
