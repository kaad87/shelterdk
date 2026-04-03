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
      .from("contact_messages")
      .select("id, name, email, category, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (String(error.message || "").includes("contact_messages")) {
        return Response.json({ messages: [], setupRequired: true });
      }
      console.error("admin contact list:", error);
      return Response.json({ error: "Kunne ikke hente beskeder" }, { status: 500 });
    }

    return Response.json({ messages: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ messages: [], setupRequired: true });
    }
    throw e;
  }
}

export async function PATCH(request: Request) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  if (!body.id || !body.status) {
    return Response.json({ error: "Mangler id eller status" }, { status: 400 });
  }

  if (!["unread", "read", "archived"].includes(body.status)) {
    return Response.json({ error: "Ugyldig status" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: body.status })
    .eq("id", body.id);

  if (error) {
    console.error("admin contact update:", error);
    return Response.json({ error: "Kunne ikke opdatere" }, { status: 500 });
  }

  return Response.json({ ok: true });
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
    .from("contact_messages")
    .delete()
    .eq("id", body.id);

  if (error) {
    console.error("admin contact delete:", error);
    return Response.json({ error: "Kunne ikke slette" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
