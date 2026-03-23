// app/api/turvenner/[slug]/contact/route.ts
import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import { validateContactInput, type ContactInput } from "@/lib/turvenner";
import { sendContactEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/turvenner/[slug]/contact
 * Body: { sender_name, sender_email, message, honeypot? }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  let body: Partial<ContactInput>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const validationError = validateContactInput(body);
  if (validationError) {
    if (validationError === "spam") {
      return Response.json({ ok: true, message: "Besked sendt!" });
    }
    return Response.json({ error: validationError }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { data: post, error: postError } = await supabase
    .from("trip_posts")
    .select("author_name, author_email, title, status, expires_at")
    .eq("slug", slug)
    .single();

  if (postError || !post) {
    return Response.json({ error: "Opslag ikke fundet." }, { status: 404 });
  }

  if (post.status !== "active" || new Date(post.expires_at) < new Date()) {
    return Response.json({ error: "Opslaget er udløbet." }, { status: 410 });
  }

  try {
    await sendContactEmail({
      toEmail: post.author_email,
      toName: post.author_name,
      senderName: body.sender_name!.trim(),
      senderEmail: body.sender_email!.trim(),
      message: body.message!.trim(),
      postTitle: post.title,
    });
  } catch {
    return Response.json({ error: "Kunne ikke sende besked. Prøv igen." }, { status: 500 });
  }

  return Response.json({ ok: true, message: "Din besked er sendt!" });
}
