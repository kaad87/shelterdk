import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { consumeOwnerClaimToken, normalizeClaimToken, resolveOwnerClaim } from "@/lib/owner-claim";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  // Tight rate limit to prevent signup-spam and claim-token brute-force.
  const rateLimited = await enforcePublicRateLimit(req, {
    scope: "ejer_signup",
    windowSeconds: 600,
    maxHits: 5,
    errorMessage:
      "For mange oprettelses-forsøg. Prøv igen om lidt eller skriv til kontakt@shelterdk.dk.",
  });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const claimToken = normalizeClaimToken(
    typeof b.claim_token === "string" ? b.claim_token : ""
  );

  if (!email || !password || !claimToken) {
    return NextResponse.json(
      { error: "Email, adgangskode og ejer-token er påkrævet" },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { claim, error: claimError } = await resolveOwnerClaim(claimToken);

  if (!claim || claim.ownerEmail !== email) {
    return NextResponse.json(
      { error: claimError ?? "Invite-link eller ejer-token matcher ikke denne email" },
      { status: 403 }
    );
  }

  if (claim.authUserId) {
    return NextResponse.json(
      { error: "Dette shelter er allerede knyttet til en konto — log ind i stedet eller kontakt os" },
      { status: 409 }
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

  // Link shelters with matching owner_email once ownership has been proven via owner token
  const { data: linked } = await admin
    .from("bookable_shelters")
    .update({ auth_user_id: data.user.id })
    .eq("owner_email", email)
    .is("auth_user_id", null)
    .select("id");

  const sheltersLinked = linked?.length ?? 0;
  if (claim.claimTokenId && sheltersLinked > 0) {
    await consumeOwnerClaimToken(claim.claimTokenId);
  }

  return NextResponse.json({ ok: true, sheltersLinked });
}
