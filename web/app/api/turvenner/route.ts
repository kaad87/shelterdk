// app/api/turvenner/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  validateCreateInput,
  generateSlug,
  computeExpiresAt,
  REGIONS,
  type CreateTripPostInput,
} from "@/lib/turvenner";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/turvenner?region=Nordjylland
 */
export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") || "";
  const supabase = createAdminClient();

  let query = supabase
    .from("trip_posts")
    .select("id, slug, author_name, title, description, trip_date, spots_available, region, shelter_id, expires_at, created_at")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (region && REGIONS.includes(region as any)) {
    query = query.eq("region", region);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Trip posts fetch error:", error);
    return Response.json({ error: "Kunne ikke hente opslag." }, { status: 500 });
  }

  return Response.json(data || []);
}

/**
 * POST /api/turvenner
 * Body: CreateTripPostInput
 */
export async function POST(request: NextRequest) {
  let body: Partial<CreateTripPostInput>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const validationError = validateCreateInput(body);
  if (validationError) {
    if (validationError === "spam") {
      return Response.json({ ok: true, message: "Tak! Dit opslag er oprettet." });
    }
    return Response.json({ error: validationError }, { status: 400 });
  }

  // Rate limiting: max 3 posts per IP per day
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const supabase = createAdminClient();

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count } = await supabase
    .from("trip_posts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneDayAgo.toISOString());

  if ((count ?? 0) >= 3) {
    return Response.json(
      { error: "Du kan maksimalt oprette 3 opslag per dag." },
      { status: 429 }
    );
  }

  const slug = generateSlug();
  const expiresAt = computeExpiresAt(body.trip_date);

  const { error } = await supabase.from("trip_posts").insert({
    slug,
    author_name: body.author_name!.trim(),
    author_email: body.author_email!.trim(),
    title: body.title!.trim(),
    description: body.description!.trim(),
    trip_date: body.trip_date || null,
    spots_available: body.spots_available!,
    region: body.region!,
    shelter_id: body.shelter_id || null,
    expires_at: expiresAt,
    status: "active",
    ip_hash: ipHash,
  });

  if (error) {
    console.error("Trip post insert error:", error);
    return Response.json({ error: "Kunne ikke oprette opslag. Prøv igen." }, { status: 500 });
  }

  return Response.json({ ok: true, message: "Dit opslag er nu live!", slug });
}
