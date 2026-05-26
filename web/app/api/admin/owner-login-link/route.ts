import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/owner-login-link
 *
 * Genererer et Supabase magic-link til at logge ind som en bestemt
 * shelter-ejer. Bruges fra admin-panelet til support — admin slipper
 * for at kende ejerens password.
 *
 * Body: { bookable_shelter_id: string }
 * Returns: { url: string, email: string, expiresAt: string }
 *
 * Beskyttet med ADMIN_SECRET (samme pattern som resten af /api/admin).
 * Hver handling logges til admin_impersonations + Supabase auth.audit_log.
 */

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shelterId = typeof body.bookable_shelter_id === "string" ? body.bookable_shelter_id.trim() : "";
  if (!shelterId) {
    return NextResponse.json({ error: "bookable_shelter_id er påkrævet" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Hent ejer-email + auth_user_id fra bookable_shelter
  const { data: shelter, error: shelterErr } = await admin
    .from("bookable_shelters")
    .select("id, owner_email, auth_user_id, title")
    .eq("id", shelterId)
    .single();

  if (shelterErr || !shelter) {
    return NextResponse.json({ error: "Shelter findes ikke" }, { status: 404 });
  }

  if (!shelter.auth_user_id) {
    return NextResponse.json(
      { error: "Ejeren har ikke en konto endnu — brug 'Send invite' først." },
      { status: 400 }
    );
  }

  // Generér magic-link via Supabase admin SDK. type="magiclink" sender
  // IKKE en email selv (vi sender heller ikke selv); vi bruger bare den
  // returnerede `action_link` direkte. Brugeren skal klikke på linket
  // for at consume det.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: shelter.owner_email,
    options: {
      redirectTo: `${SITE_ORIGIN}/ejer/dashboard`,
    },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkErr?.message ?? "Kunne ikke generere login-link" },
      { status: 500 }
    );
  }

  // Audit-log
  const ipAddress =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  void admin
    .from("admin_impersonations")
    .insert({
      target_user_id: shelter.auth_user_id,
      target_email: shelter.owner_email,
      target_shelter_id: shelter.id,
      admin_ip: ipAddress,
      admin_user_agent: userAgent,
    })
    .then(({ error }) => {
      if (error) console.error("admin_impersonations log failed:", error.message);
    });

  // Supabase magic-link gælder typisk 1 time. Vi returnerer en grov
  // estimat så UI'et kan vise det. (Den faktiske gyldighed afhænger af
  // Supabase project settings: auth.email.otp_exp.)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return NextResponse.json({
    url: linkData.properties.action_link,
    email: shelter.owner_email,
    shelter_title: shelter.title,
    expiresAt,
  });
}
