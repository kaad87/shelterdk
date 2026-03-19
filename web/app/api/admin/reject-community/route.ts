import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

/**
 * POST /api/admin/reject-community
 * Body: { submissionId: string, note?: string }
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { submissionId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  const note = body.note?.trim() || null;

  if (!submissionId) {
    return Response.json({ error: "Mangler submissionId" }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { error } = await supabase
    .from("community_submissions")
    .update({
      status: "rejected",
      moderation_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
