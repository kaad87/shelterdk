import { NextRequest, NextResponse } from "next/server";
import { syncIcalForShelter } from "@/lib/ical-sync";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  if (!context.shelter.ical_import_url) {
    return NextResponse.json({ error: "Ingen iCal-URL konfigureret" }, { status: 400 });
  }

  try {
    const { blockedCount } = await syncIcalForShelter(
      context.shelter.id,
      context.shelter.ical_import_url
    );
    return NextResponse.json({ ok: true, blockedCount, lastSynced: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Synk fejlede";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
