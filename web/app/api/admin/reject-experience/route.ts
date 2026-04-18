import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { experienceId?: string; reason?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Ugyldig JSON" }, { status: 400 }); }

  const id = body.experienceId?.trim();
  if (!id) return Response.json({ error: "Mangler experienceId" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shelter_experiences")
    .update({ status: "rejected", rejected_reason: body.reason?.trim() ?? null })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
