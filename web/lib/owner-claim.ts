import { createAdminClient } from "@/utils/supabase/server-admin";

export interface ResolvedOwnerClaim {
  shelterId: string;
  ownerEmail: string;
  authUserId: string | null;
  claimTokenId: string | null;
}

export function normalizeClaimToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const ownerMatch = url.pathname.match(/\/owner\/([^/]+)/);
    if (ownerMatch?.[1]) return ownerMatch[1].trim();
    const claim = url.searchParams.get("claim");
    return claim?.trim() ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function createOwnerClaimToken(shelterId: string, ownerEmail: string) {
  const { data, error } = await createAdminClient()
    .from("owner_claim_tokens")
    .insert({
      shelter_id: shelterId,
      owner_email: ownerEmail,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Kunne ikke oprette claim-token");
  }

  return data as { id: string; token: string; expires_at: string };
}

export async function resolveOwnerClaim(rawToken: string): Promise<{
  claim: ResolvedOwnerClaim | null;
  error: string | null;
}> {
  const token = normalizeClaimToken(rawToken);
  if (!token) return { claim: null, error: "Invite-link eller ejer-token mangler" };

  const admin = createAdminClient();

  const { data: claimToken } = await admin
    .from("owner_claim_tokens")
    .select("id, shelter_id, owner_email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (claimToken) {
    if (claimToken.used_at) {
      return { claim: null, error: "Invite-linket er allerede brugt" };
    }
    if (new Date(claimToken.expires_at).getTime() <= Date.now()) {
      return { claim: null, error: "Invite-linket er udløbet" };
    }
    const { data: shelter } = await admin
      .from("bookable_shelters")
      .select("id, owner_email, auth_user_id")
      .eq("id", claimToken.shelter_id)
      .maybeSingle();

    if (!shelter) {
      return { claim: null, error: "Shelteret bag invite-linket findes ikke længere" };
    }

    return {
      claim: {
        shelterId: shelter.id,
        ownerEmail: String(claimToken.owner_email ?? shelter.owner_email).trim().toLowerCase(),
        authUserId: shelter.auth_user_id ?? null,
        claimTokenId: claimToken.id,
      },
      error: null,
    };
  }

  const { data: legacyShelter } = await admin
    .from("bookable_shelters")
    .select("id, owner_email, auth_user_id")
    .eq("owner_token", token)
    .maybeSingle();

  if (!legacyShelter) {
    return { claim: null, error: "Ugyldigt invite-link eller ejer-token" };
  }

  return {
    claim: {
      shelterId: legacyShelter.id,
      ownerEmail: legacyShelter.owner_email.trim().toLowerCase(),
      authUserId: legacyShelter.auth_user_id ?? null,
      claimTokenId: null,
    },
    error: null,
  };
}

export async function consumeOwnerClaimToken(claimTokenId: string) {
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("owner_claim_tokens")
    .update({ used_at: now })
    .eq("id", claimTokenId)
    .is("used_at", null);

  if (error) throw new Error(error.message);
}
