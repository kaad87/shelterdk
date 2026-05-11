import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, updateOwnerShelter, type OwnerShelterUpdate } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const update: OwnerShelterUpdate = {};

  if ("title" in b) {
    const t = typeof b.title === "string" ? b.title.trim() : "";
    if (!t || t.length > 100) {
      return NextResponse.json({ error: "Titel skal være 1–100 tegn" }, { status: 400 });
    }
    update.title = t;
  }

  if ("description" in b) {
    const d = typeof b.description === "string" ? b.description.trim() : "";
    if (d.length > 4000) {
      return NextResponse.json({ error: "Beskrivelse må højst være 4000 tegn" }, { status: 400 });
    }
    update.description = d;
  }

  if ("max_persons" in b) {
    const n = Number(b.max_persons);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "Maks. personer skal være 1–50" }, { status: 400 });
    }
    update.max_persons = n;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Ingen felter at opdatere" }, { status: 400 });
  }

  const updated = await updateOwnerShelter(id, update);
  if (!updated) return NextResponse.json({ error: "Opdatering fejlede" }, { status: 500 });

  return NextResponse.json({ ok: true, shelter: updated });
}
