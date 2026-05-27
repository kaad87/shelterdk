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
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient()
    .from("outreach_templates")
    .select("subject, body, updated_at")
    .eq("id", "default")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Template ikke fundet" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const tplBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!subject || subject.length > 300) {
    return NextResponse.json({ error: "Emne skal være 1–300 tegn" }, { status: 400 });
  }
  if (!tplBody || tplBody.length > 20000) {
    return NextResponse.json({ error: "Body skal være 1–20.000 tegn" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("outreach_templates")
    .upsert({
      id: "default",
      subject,
      body: tplBody,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
