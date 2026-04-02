import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, source, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      if (String(error.message || "").includes("newsletter_subscribers")) {
        return Response.json({ subscribers: [], setupRequired: true });
      }
      console.error("admin newsletter list:", error);
      return Response.json({ error: "Kunne ikke hente liste" }, { status: 500 });
    }

    return Response.json({ subscribers: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ subscribers: [], setupRequired: true });
    }
    throw e;
  }
}

export async function DELETE(request: Request) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  if (!body.id) {
    return Response.json({ error: "Mangler id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("id", body.id);

  if (error) {
    console.error("admin newsletter delete:", error);
    return Response.json({ error: "Kunne ikke slette" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
