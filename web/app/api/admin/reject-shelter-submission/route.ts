// web/app/api/admin/reject-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { submissionId?: string; reason?: string };
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
  const { error } = await supabase
    .from("shelter_submissions")
    .update({
      status: "rejected",
      rejected_reason: body.reason?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending"); // idempotency guard

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
