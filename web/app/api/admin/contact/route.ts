import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendAdminReplyEmail } from "@/lib/email";

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

  if (!["unread", "read", "archived", "replied"].includes(body.status)) {
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

export async function POST(request: Request) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; replyText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  const replyText = body.replyText?.trim();

  if (!id || !replyText) {
    return Response.json({ error: "Mangler id eller replyText" }, { status: 400 });
  }
  if (replyText.length > 5000) {
    return Response.json({ error: "Svaret er for langt (max 5000 tegn)" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Ugyldigt id" }, { status: 400 });
  }

  // Fetch original message
  const supabase = createAdminClient();
  const { data: msg, error: fetchError } = await supabase
    .from("contact_messages")
    .select("id, name, email, message")
    .eq("id", id)
    .single();

  if (fetchError || !msg) {
    return Response.json({ error: "Besked ikke fundet" }, { status: 404 });
  }

  // Send email first — if it fails, do NOT update DB status
  try {
    await sendAdminReplyEmail({
      toEmail: msg.email as string,
      toName: msg.name as string,
      replyText,
      originalMessage: msg.message as string,
      contactMessageId: id,
    });
  } catch (err) {
    console.error("admin reply send failed:", err);
    return Response.json(
      { error: "Kunne ikke sende svar — prøv igen." },
      { status: 502 }
    );
  }

  // Email sent — now update status
  const { error: updateError } = await supabase
    .from("contact_messages")
    .update({ status: "replied" })
    .eq("id", id);

  if (updateError) {
    console.error("admin reply status update failed after send:", updateError);
    return Response.json(
      { error: "Svar sendt, men status kunne ikke opdateres — opdater siden." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
