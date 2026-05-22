import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Tight rate limit to slow down credential-stuffing / brute-force attempts.
  // 8 attempts per 5 min per IP is generous for legitimate typo correction.
  const rateLimited = await enforcePublicRateLimit(req, {
    scope: "ejer_login",
    windowSeconds: 300,
    maxHits: 8,
    errorMessage:
      "For mange login-forsøg. Prøv igen om et par minutter eller brug 'Glemt adgangskode'.",
  });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email og adgangskode er påkrævet" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Forkert email eller adgangskode" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
