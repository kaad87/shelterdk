import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2)
    return NextResponse.json({ shelters: [] });

  const { data, error } = await createAdminClient()
    .from("shelters")
    .select("id, title, slug, kommune, region")
    .ilike("title", `%${q}%`)
    .limit(8);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shelters: data ?? [] });
}
