import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
