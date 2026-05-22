import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Prevent password-reset spam and email-enumeration abuse.
  const rateLimited = await enforcePublicRateLimit(req, {
    scope: "ejer_password_reset",
    windowSeconds: 600,
    maxHits: 5,
    errorMessage:
      "For mange nulstillings-forsøg. Prøv igen om lidt — tjek også din spam-mappe.",
  });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email er påkrævet" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const redirectTo = `${req.nextUrl.origin}/ejer/nulstil-adgangskode`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return NextResponse.json({ error: "Kunne ikke sende nulstillingsmail" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
