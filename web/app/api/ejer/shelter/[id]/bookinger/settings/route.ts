import { NextRequest, NextResponse } from "next/server";
import { saveIcalImportUrl } from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const shelter = context.shelter;

  if ("cancellation_cutoff_hours" in body) {
    const raw = Number(body.cancellation_cutoff_hours);
    if (!Number.isInteger(raw) || raw < 0) {
      return NextResponse.json({ error: "Ugyldig aflysningsfrist" }, { status: 400 });
    }
    const { error: cutoffError } = await createAdminClient()
      .from("bookable_shelters")
      .update({ cancellation_cutoff_hours: raw })
      .eq("id", shelter.id);
    if (cutoffError) return NextResponse.json({ error: cutoffError.message }, { status: 500 });

    if (!("ical_import_url" in body)) return NextResponse.json({ ok: true });
  }

  let url: string | null = body.ical_import_url ?? null;

  if (url !== null) {
    url = url.trim();
    if (url.length === 0) {
      url = null;
    } else {
      url = url.replace(/^webcal:\/\//i, "https://");
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return NextResponse.json(
          { error: "Ugyldig URL — skal starte med http:// eller https://" },
          { status: 400 }
        );
      }
    }
  }

  await saveIcalImportUrl(shelter.id, url);

  let blockedCount = 0;
  let lastSynced: string | null = null;
  if (url) {
    try {
      const result = await syncIcalForShelter(shelter.id, url);
      blockedCount = result.blockedCount;
      lastSynced = new Date().toISOString();
    } catch (err) {
      console.error("Initial iCal sync failed:", err);
      return NextResponse.json({
        ok: true,
        blockedCount: 0,
        lastSynced: null,
        syncError: "Synk fejlede — tjek at URL'en er korrekt",
      });
    }
  }

  return NextResponse.json({ ok: true, blockedCount, lastSynced });
}
