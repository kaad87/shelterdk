import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { parseFacilitiesPayload, sanitizeCommentText } from "@/lib/community";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * POST /api/admin/approve-community
 * Body: { submissionId: string }
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { submissionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    return Response.json({ error: "Mangler submissionId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: sub, error: subError } = await supabase
    .from("community_submissions")
    .select("id, shelter_id, type, payload, status, submitter_name")
    .eq("id", submissionId)
    .single();

  if (subError || !sub) {
    return Response.json({ error: "Submission ikke fundet" }, { status: 404 });
  }
  if (sub.status !== "pending") {
    return Response.json({ error: "Submission er allerede behandlet" }, { status: 400 });
  }

  if (sub.type === "comment") {
    const text = sanitizeCommentText((sub.payload as { text?: string } | null)?.text);
    if (!text) {
      return Response.json({ error: "Kommentar mangler tekst" }, { status: 400 });
    }

    const { error: commentError } = await supabase.from("shelter_comments").insert({
      shelter_id: sub.shelter_id,
      author_name: (sub.submitter_name || "Bruger").trim(),
      comment_text: text,
      source_submission_id: sub.id,
    });
    if (commentError) {
      return Response.json(
        { error: "Kunne ikke gemme kommentar: " + commentError.message },
        { status: 500 }
      );
    }
  } else if (sub.type === "facilities_update") {
    const values = parseFacilitiesPayload(sub.payload);
    const { error: upsertError } = await supabase
      .from("shelter_community_facts")
      .upsert(
        {
          shelter_id: sub.shelter_id,
          ...values,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shelter_id" }
      );
    if (upsertError) {
      return Response.json(
        { error: "Kunne ikke opdatere faciliteter: " + upsertError.message },
        { status: 500 }
      );
    }
  } else {
    return Response.json({ error: "Ukendt submission-type" }, { status: 400 });
  }

  const { error: updateSubError } = await supabase
    .from("community_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (updateSubError) {
    return Response.json(
      { error: "Kunne ikke markere submission som godkendt: " + updateSubError.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
