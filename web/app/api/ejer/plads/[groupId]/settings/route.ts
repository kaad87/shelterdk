import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getAuthenticatedOwnerGroupContext } from "@/lib/ejer-auth";
import { updateSharedShelterContent } from "@/lib/owner-db";

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

  if (Object.keys(updates).length === 0 && sharedDescription === undefined) {
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

  if (sharedDescription !== undefined) {
    const updated = await updateSharedShelterContent(groupId, {
      description: sharedDescription || null,
    });
    if (!updated) {
      return NextResponse.json({ error: "Kunne ikke opdatere fælles beskrivelse" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, updatedCount: unitIds.length });
}
