import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendGa4Event } from "@/lib/server-analytics";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // DB-backed rate limit replaces the old in-memory Map (which leaked
  // memory and didn't work across serverless instances).
  const rateLimited = await enforcePublicRateLimit(request, {
    scope: "contact_form",
    windowSeconds: 60,
    maxHits: 3,
    errorMessage: "For mange beskeder. Prøv igen om lidt.",
  });
  if (rateLimited) return rateLimited;

  let body: { name?: string; email?: string; category?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const category = body.category?.trim() || "general";
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return Response.json(
      { error: "Udfyld venligst navn, email og besked." },
      { status: 400 }
    );
  }

  if (message.length > 5000) {
    return Response.json(
      { error: "Beskeden er for lang (max 5000 tegn)." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({ error: "Ugyldig email-adresse." }, { status: 400 });
  }

  // Must use the admin client now that RLS is enabled on contact_messages
  // (migration 045). Anon SDK has no INSERT policy by design — writes go
  // through this rate-limited server-side route only.
  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert({
    name,
    email,
    category,
    message,
  });

  if (error) {
    console.error("contact insert:", error);
    return Response.json(
      { error: "Kunne ikke sende besked. Prøv igen." },
      { status: 500 }
    );
  }

  await sendGa4Event({
    headers: request.headers,
    eventName: "contact_form_submitted",
    path: request.headers.get("referer") ?? undefined,
    referrer: request.headers.get("referer") ?? undefined,
    eventParams: {
      contact_category: category,
      message_length: message.length,
    },
  });

  return Response.json({ ok: true });
}
