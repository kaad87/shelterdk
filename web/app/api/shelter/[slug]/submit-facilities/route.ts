import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  parseFacilitiesPayload,
  hasAtLeastOneFacilityValue,
  sanitizeSubmitterName,
} from "@/lib/community";

export const dynamic = "force-dynamic";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * POST /api/shelter/[slug]/submit-facilities
 * Body: { name: string, email?: string, facilities: Record<string, "yes"|"no"|"unknown"> }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  let body: { name?: string; email?: string; facilities?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const name = sanitizeSubmitterName(body.name);
  const email = body.email?.trim() || null;
  const facilities = parseFacilitiesPayload(body.facilities);

  if (!name || name.length < 2 || name.length > 60) {
    return Response.json({ error: "Navn skal være mellem 2 og 60 tegn." }, { status: 400 });
  }
  if (!hasAtLeastOneFacilityValue(facilities)) {
    return Response.json({ error: "Vælg mindst én facilitet." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: shelter, error: shelterError } = await supabase
    .from("shelters")
    .select("id")
    .eq("slug", slug)
    .single();

  if (shelterError || !shelter?.id) {
    return Response.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  const authUser = await getAuthUser(request);

  const { error } = await supabase.from("community_submissions").insert({
    shelter_id: shelter.id,
    type: "facilities_update",
    status: "pending",
    submitter_name: name,
    submitter_email: email,
    submitter_user_id: authUser?.id ?? null,
    payload: facilities,
  });

  if (error) {
    console.error("Facilities submission error:", error);
    if (String(error.message || "").includes("community_submissions")) {
      return Response.json(
        { error: "Community-funktion er ikke aktiveret endnu (DB migration mangler)." },
        { status: 503 }
      );
    }
    return Response.json({ error: "Kunne ikke sende forslag. Prøv igen." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    message: "Tak! Dine facilitet-oplysninger er sendt til godkendelse.",
  });
}
