import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
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
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn` },
      { status: 400 }
    );
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const isExisting =
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists");
    if (isExisting) {
      return NextResponse.json(
        { error: "Der findes allerede en konto med denne email — log ind i stedet" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    // Email confirmation is enabled — should not happen in production setup
    return NextResponse.json(
      { error: "Konto oprettet — tjek din email for at bekræfte" },
      { status: 202 }
    );
  }

  // Link shelters with matching owner_email to this new auth user
  const { data: linked } = await createAdminClient()
    .from("bookable_shelters")
    .update({ auth_user_id: data.user.id })
    .eq("owner_email", email)
    .is("auth_user_id", null)
    .select("id");

  const sheltersLinked = linked?.length ?? 0;

  return NextResponse.json({ ok: true, sheltersLinked });
}
