import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Mangler email" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("email", email);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
