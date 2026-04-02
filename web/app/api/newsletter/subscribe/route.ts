import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json(
      { error: "Indtast en gyldig email-adresse." },
      { status: 400 }
    );
  }

  const source = body.source?.trim() || "unknown";

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });

    if (error) {
      if (String(error.message || "").includes("newsletter_subscribers")) {
        return Response.json(
          { error: "Newsletter-funktionen er ikke aktiveret endnu." },
          { status: 503 }
        );
      }
      console.error("newsletter subscribe:", error);
      return Response.json({ error: "Noget gik galt." }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ error: "Ikke konfigureret." }, { status: 503 });
    }
    throw e;
  }
}
