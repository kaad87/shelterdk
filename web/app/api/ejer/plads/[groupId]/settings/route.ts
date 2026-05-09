import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getAuthenticatedOwnerGroupContext } from "@/lib/ejer-auth";
import { extractPhotoPath, isOwnerPhotoPath, updateSharedShelterContent } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const context = await getAuthenticatedOwnerGroupContext(groupId);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let sharedDescription: string | undefined;
  let userImageUrls: string[] | undefined;
  let sharedShelterFields:
    | {
        user_image_urls?: string[] | null;
        water?: boolean | null;
        toilet?: "flush" | "mulch" | "none" | "unknown" | null;
        geofa_raw?: Record<string, unknown> | null;
      }
    | undefined;
  const updates: Record<string, number> = {};

  if ("cancellation_cutoff_hours" in body) {
    const cutoffHours = Number(body.cancellation_cutoff_hours);
    if (!Number.isInteger(cutoffHours) || cutoffHours < 0) {
      return NextResponse.json({ error: "Ugyldig aflysningsfrist" }, { status: 400 });
    }
    updates.cancellation_cutoff_hours = cutoffHours;
  }

  if ("shared_description" in body) {
    const raw = typeof body.shared_description === "string" ? body.shared_description.trim() : "";
    if (raw.length > 2000) {
      return NextResponse.json({ error: "Beskrivelse må højst være 2000 tegn" }, { status: 400 });
    }
    sharedDescription = raw;
  }

  if ("user_image_urls" in body) {
    const rawUserImageUrls = body.user_image_urls;
    if (
      !Array.isArray(rawUserImageUrls) ||
      !(rawUserImageUrls as unknown[]).every((value: unknown) => typeof value === "string")
    ) {
      return NextResponse.json({ error: "Ugyldig billedrækkefølge" }, { status: 400 });
    }

    userImageUrls = rawUserImageUrls as string[];
    const invalidUrl = userImageUrls.find((url) => {
      const path = extractPhotoPath(url);
      return !path || !isOwnerPhotoPath(path, groupId);
    });
    if (invalidUrl) {
      return NextResponse.json({ error: "Kun ejer-uploadede billeder kan gemmes i rækkefølgen" }, { status: 400 });
    }
  }

  if ("facilities" in body) {
    const facilities = body.facilities as Record<string, unknown>;
    if (!facilities || typeof facilities !== "object") {
      return NextResponse.json({ error: "Ugyldige faciliteter" }, { status: 400 });
    }

    const boolKeys = ["water", "baalplads", "hund", "bord_baenk", "strand", "bruser", "handicap"] as const;
    for (const key of boolKeys) {
      if (typeof facilities[key] !== "boolean") {
        return NextResponse.json({ error: "Ugyldige faciliteter" }, { status: 400 });
      }
    }

    const toilet = facilities.toilet;
    if (!["flush", "mulch", "none"].includes(String(toilet))) {
      return NextResponse.json({ error: "Ugyldig toilettype" }, { status: 400 });
    }

    const { data: currentShelter } = await createAdminClient()
      .from("shelters")
      .select("geofa_raw")
      .eq("id", groupId)
      .single();

    const currentRaw = ((currentShelter?.geofa_raw as Record<string, unknown> | null) ?? {});
    sharedShelterFields = {
      ...(sharedShelterFields ?? {}),
      water: facilities.water as boolean,
      toilet: toilet as "flush" | "mulch" | "none",
      geofa_raw: {
        ...currentRaw,
        baalplads: facilities.baalplads ? "Ja" : "Nej",
        baal_tilladelse: facilities.baalplads ? "Ja" : "Nej",
        hunde_tilladt: facilities.hund ? "Ja" : "Nej",
        bord_baenk: facilities.bord_baenk ? "Ja" : "Nej",
        strand_naerhed: facilities.strand ? "Ja" : "Nej",
        bruser_bad: facilities.bruser ? "Ja" : "Nej",
        handicap: facilities.handicap ? "Handicapegnet" : "Ikke handicapegnet",
      },
    };
  }

  if (userImageUrls !== undefined) {
    sharedShelterFields = {
      ...(sharedShelterFields ?? {}),
      user_image_urls: userImageUrls,
    };
  }

  if (Object.keys(updates).length === 0 && sharedDescription === undefined && !sharedShelterFields) {
    return NextResponse.json({ error: "Ingen gyldige felter at gemme" }, { status: 400 });
  }

  const unitIds = context.shelters.map((s) => s.id);
  if (Object.keys(updates).length > 0) {
    const { error } = await createAdminClient()
      .from("bookable_shelters")
      .update(updates)
      .in("id", unitIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (sharedDescription !== undefined || sharedShelterFields) {
    const updated = await updateSharedShelterContent(groupId, {
      ...(sharedShelterFields ?? {}),
      ...(sharedDescription !== undefined ? { description: sharedDescription || null } : {}),
    });
    if (!updated) {
      return NextResponse.json({ error: "Kunne ikke opdatere fælles shelterside" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, updatedCount: unitIds.length });
}
