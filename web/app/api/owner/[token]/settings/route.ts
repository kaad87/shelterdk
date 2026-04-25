import { NextRequest, NextResponse } from "next/server";
import {
  getBookableShelterByOwnerToken,
  saveIcalImportUrl,
} from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Handle shelter price update
  if ("shelter_price_dkk" in body) {
    const raw = body.shelter_price_dkk;
    const priceDkk = raw === null || raw === "" ? null : Number(raw);
    if (priceDkk !== null && (isNaN(priceDkk) || priceDkk < 0)) {
      return NextResponse.json({ error: "Ugyldig pris" }, { status: 400 });
    }
    const { error: priceError } = await createAdminClient()
      .from("bookable_shelters")
      .update({ shelter_price_dkk: priceDkk })
      .eq("id", shelter.id);
    if (priceError) return NextResponse.json({ error: priceError.message }, { status: 500 });

    // If only price was sent (no iCal fields), return early
    if (!("ical_import_url" in body)) return NextResponse.json({ ok: true });
  }

  let url: string | null = body.ical_import_url ?? null;

  if (url !== null) {
    url = url.trim();
    if (url.length === 0) {
      url = null; // treat empty string as "clear the URL"
    } else {
      // Normalise webcal:// before saving
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

  // Trigger immediate sync if URL was provided
  let blockedCount = 0;
  let lastSynced: string | null = null;
  if (url) {
    try {
      const result = await syncIcalForShelter(shelter.id, url);
      blockedCount = result.blockedCount;
      lastSynced = new Date().toISOString();
    } catch (err) {
      console.error("Initial iCal sync failed:", err);
      // Don't fail the settings save — URL was saved, sync failed
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
