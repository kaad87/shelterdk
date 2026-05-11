import { NextRequest, NextResponse } from "next/server";
import { saveIcalImportUrl } from "@/lib/booking-db";
import { syncIcalForShelter } from "@/lib/ical-sync";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { updateSharedShelterContent } from "@/lib/owner-db";
import { MAX_PHOTOS } from "@shared/lib/shelter-detail";

export const dynamic = "force-dynamic";

const GEOFA_PHOTO_KEYS = [
  "foto_link", "foto_link1", "foto_link2", "foto_link3",
  "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3",
] as const;

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

    if (!("ical_import_url" in body) && !("photo_order" in body)) {
      return NextResponse.json({ ok: true });
    }
  }

  if ("photo_order" in body) {
    const shelterDbId = shelter.shelter_id;
    if (!shelterDbId) {
      return NextResponse.json({ error: "Shelter ikke linket til kataloget" }, { status: 400 });
    }

    const rawPhotoOrder = body.photo_order;
    if (
      !Array.isArray(rawPhotoOrder) ||
      !(rawPhotoOrder as unknown[]).every((v) => typeof v === "string")
    ) {
      return NextResponse.json({ error: "Ugyldig billedrækkefølge" }, { status: 400 });
    }
    const photoOrder = rawPhotoOrder as string[];
    if (photoOrder.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Maks. ${MAX_PHOTOS} billeder tilladt` }, { status: 422 });
    }

    // Build allowset from all known photo sources
    const { data: shelterData } = await createAdminClient()
      .from("shelters")
      .select("image_url, image_urls, user_image_urls, geofa_raw")
      .eq("id", shelterDbId)
      .single();

    const allowset = new Set<string>();
    if (shelterData) {
      if (shelterData.image_url) allowset.add(shelterData.image_url as string);
      const imgUrls = shelterData.image_urls as string[] | null;
      if (Array.isArray(imgUrls)) imgUrls.forEach((u) => allowset.add(u));
      const userUrls = shelterData.user_image_urls as string[] | null;
      const userUrlsArr: string[] = Array.isArray(userUrls) ? userUrls : [];
      userUrlsArr.forEach((u) => allowset.add(u));
      const raw = (shelterData.geofa_raw as Record<string, unknown> | null) ?? {};
      for (const k of GEOFA_PHOTO_KEYS) {
        const v = raw[k];
        if (typeof v === "string" && v.trim()) allowset.add(v.trim());
      }
    }

    const invalidUrl = photoOrder.find((url) => !allowset.has(url));
    if (invalidUrl) {
      return NextResponse.json({ error: "Ukendt billed-URL i rækkefølgen" }, { status: 400 });
    }

    const updated = await updateSharedShelterContent(shelterDbId, { photo_order: photoOrder });
    if (!updated) {
      return NextResponse.json({ error: "Kunne ikke gemme billedrækkefølge" }, { status: 500 });
    }

    if (!("ical_import_url" in body)) {
      return NextResponse.json({ ok: true });
    }
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
