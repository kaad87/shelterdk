import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canPublishStay } from "@/lib/nature-stays";

export const dynamic = "force-dynamic";

function admin(req: NextRequest): SupabaseClient | null {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

const FIELDS = [
  "slug", "name", "operator_name", "type", "region", "kommune", "place", "location",
  "short_description", "body_md", "image_url", "image_urls", "image_permission",
  "price_from", "capacity", "amenities", "rating", "booking_url", "link_source",
  "featured", "sort_boost", "status", "last_verified_at",
] as const;

/** GET — alle steder (inkl. draft) til admin. */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb
    .from("nature_stays")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stays: data ?? [] });
}

/** POST — opret/opdatér sted. Med id => update, uden => insert. */
export async function POST(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.slug !== "string" || typeof body.name !== "string" || typeof body.type !== "string") {
    return NextResponse.json({ error: "slug, name, type påkrævet" }, { status: 400 });
  }
  const row: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) row[f] = body[f];

  // Robust numerik: tom streng/null → null (undgå "invalid input syntax for
  // type integer"). Route er trust-boundary — sanitér uanset klient.
  for (const f of ["price_from", "capacity", "rating", "sort_boost"] as const) {
    if (f in row) row[f] = row[f] === "" || row[f] == null ? null : Number(row[f]);
  }
  if (row.sort_boost == null) delete row.sort_boost; // NOT NULL → brug default 0

  // Validér location strengt: ét ugyldigt WKT (fx 'POINT(NaN NaN)') ville få
  // ST_GeomFromText i get_nearby_stays til at kaste for ALLE rækker → Plan B
  // nede globalt. Accepter kun 'POINT(lng lat)' med tal i gyldige intervaller.
  if ("location" in row) {
    const loc = row.location;
    if (loc === "" || loc == null) {
      row.location = null;
    } else if (typeof loc === "string") {
      const m = loc.trim().match(/^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
      const lng = m ? Number(m[1]) : NaN;
      const lat = m ? Number(m[2]) : NaN;
      if (!m || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return NextResponse.json(
          { error: "Ugyldig location. Forventet 'POINT(lng lat)' med lng∈[-180,180], lat∈[-90,90]." },
          { status: 400 }
        );
      }
      row.location = `POINT(${lng} ${lat})`;
    } else {
      return NextResponse.json({ error: "location skal være en streng eller null" }, { status: 400 });
    }
  }

  const isUpdate = typeof body.id === "number";

  // Håndhæv spec §1: publicering kræver billede + dokumenteret tilladelse.
  if (row.status === "published") {
    let image_url = row.image_url as string | null | undefined;
    let image_permission = row.image_permission as string | null | undefined;
    if (isUpdate && (image_url === undefined || image_permission === undefined)) {
      const { data: existing } = await sb
        .from("nature_stays")
        .select("image_url, image_permission")
        .eq("id", body.id)
        .single();
      if (image_url === undefined) image_url = existing?.image_url ?? null;
      if (image_permission === undefined) image_permission = existing?.image_permission ?? null;
    }
    if (!canPublishStay({ image_url: image_url ?? null, image_permission: image_permission ?? null })) {
      return NextResponse.json(
        { error: "Kan ikke publicere uden billede OG dokumenteret billedtilladelse (image_permission)." },
        { status: 400 }
      );
    }
  }

  if (isUpdate) {
    const { data, error } = await sb.from("nature_stays").update(row).eq("id", body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ stay: data });
  }
  const { data, error } = await sb.from("nature_stays").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stay: data });
}

/** DELETE — { id }. */
export async function DELETE(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "number") return NextResponse.json({ error: "id påkrævet" }, { status: 400 });
  const { error } = await sb.from("nature_stays").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
