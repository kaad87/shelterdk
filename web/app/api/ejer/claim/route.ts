import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { consumeOwnerClaimToken, normalizeClaimToken, resolveOwnerClaim } from "@/lib/owner-claim";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du skal være logget ind" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const claimToken = normalizeClaimToken(
    typeof body.claim_token === "string" ? body.claim_token : ""
  );

  if (!claimToken) {
    return NextResponse.json({ error: "Invite-link eller claim-token mangler" }, { status: 400 });
  }

  const { claim, error } = await resolveOwnerClaim(claimToken);
  if (!claim) {
    return NextResponse.json({ error: error ?? "Ugyldigt invite-link" }, { status: 403 });
  }

  if (claim.ownerEmail !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Denne konto matcher ikke emailen på invite-linket" },
      { status: 403 }
    );
  }

  if (claim.authUserId && claim.authUserId !== user.id) {
    return NextResponse.json(
      { error: "Dette shelter er allerede knyttet til en anden konto" },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { data: linked, error: linkError } = await admin
    .from("bookable_shelters")
    .update({ auth_user_id: user.id })
    .eq("owner_email", claim.ownerEmail)
    .is("auth_user_id", null)
    .select("id");

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  if (claim.claimTokenId && (linked?.length ?? 0) > 0) {
    await consumeOwnerClaimToken(claim.claimTokenId);
  }

  return NextResponse.json({ ok: true, sheltersLinked: linked?.length ?? 0 });
}
