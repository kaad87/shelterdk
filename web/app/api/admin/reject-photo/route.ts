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
 * POST /api/admin/reject-photo
 * Body: { submissionId: string }
 * Sætter submission til rejected.
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

  const supabase = createPublicClient();

  const { data: sub } = await supabase
    .from("shelter_photo_submissions")
    .select("id, status")
    .eq("id", submissionId)
    .single();

  if (!sub) {
    return Response.json({ error: "Submission ikke fundet" }, { status: 404 });
  }
  if (sub.status !== "pending") {
    return Response.json({ error: "Submission er allerede behandlet" }, { status: 400 });
  }

  const { error } = await supabase
    .from("shelter_photo_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
