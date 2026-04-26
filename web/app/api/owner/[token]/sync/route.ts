import { NextRequest, NextResponse } from "next/server";
import { getBookableShelterByOwnerToken } from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  if (!shelter.ical_import_url) {
    return NextResponse.json({ error: "Ingen iCal-URL konfigureret" }, { status: 400 });
  }

  try {
    const { blockedCount } = await syncIcalForShelter(shelter.id, shelter.ical_import_url);
    return NextResponse.json({ ok: true, blockedCount, lastSynced: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Synk fejlede";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
