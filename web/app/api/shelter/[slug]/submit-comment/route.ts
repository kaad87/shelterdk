import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sanitizeCommentText, sanitizeSubmitterName } from "@/lib/community";

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
 * POST /api/shelter/[slug]/submit-comment
 * Body: { name: string, text: string, email?: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  let body: { name?: string; text?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const text = sanitizeCommentText(body.text);
  const name = sanitizeSubmitterName(body.name);
  const email = body.email?.trim() || null;

  if (!name || name.length < 2 || name.length > 60) {
    return Response.json({ error: "Navn skal være mellem 2 og 60 tegn." }, { status: 400 });
  }
  if (!text || text.length < 10 || text.length > 1500) {
    return Response.json({ error: "Tip skal være mellem 10 og 1500 tegn." }, { status: 400 });
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
    type: "comment",
    status: "pending",
    submitter_name: name,
    submitter_email: email,
    submitter_user_id: authUser?.id ?? null,
    payload: { text },
  });

  if (error) {
    console.error("Comment submission error:", error);
    if (String(error.message || "").includes("community_submissions")) {
      return Response.json(
        { error: "Community-funktion er ikke aktiveret endnu (DB migration mangler)." },
        { status: 503 }
      );
    }
    return Response.json({ error: "Kunne ikke sende kommentar. Prøv igen." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    message: "Tak! Dit tip er sendt til godkendelse.",
  });
}
